---
slug: "affectgpt-r1"
articleId: "article-003"
language: "en"
title: "Implementation of AffectGPT-R1"
author: "Haichao Wang"
tags: ["affectgpt", "multimodal", "reinforcement-learning"]
---

## Cold Start

The cold-start stage uses large-scale, coarse-grained descriptive emotion data so that the model first acquires basic multimodal emotion understanding and output-format alignment. It also provides a stable initialization for later reinforcement learning on high-quality, fine-grained OV-MER data, where rewards are computed and the policy is updated.

The cold-start stage uses the MERCaption+ dataset. This dataset provides an additional `description` field, which can be used as supervision for the thinking part.

The model input consists of video content and a user instruction. The video content includes visual, audio, and text/subtitle information. The user instruction asks the model to recognize the character's emotional state and output the result in a fixed format. Unlike the original AffectGPT, which only outputs emotion words, AffectGPT-R1 requires the model to output two parts during cold start: one part inside `<think>...</think>`, representing the emotional reasoning process, and another part inside `<answer>...</answer>`, representing the final open-vocabulary emotion label.

Therefore, in the autoregressive teacher-forcing stage, the training target must be changed from a single emotion label to a structured output formed by concatenating `description` and `answer`. The data loading and QA construction logic must be updated accordingly.

In `base_dataset.py`, several key variables are involved:

1. `label_type_candidates`: the list of label types supported by a dataset. This depends on the specific dataset. For example, `ovmerd_dataset.py` defines `['description', 'ovlabel']`.
2. `label_type`: comes from `dataset_cfg.label_type` in the dataset configuration and determines the annotation form of the current dataset sample. If it is set to `hybrid`, one type is randomly selected from the candidates each time.
3. `question`: specifies the current task and is usually defined in the `get_qa` family of functions.
4. `prompt`: the full input text actually fed into the model. It may include instructions, context, formatting requirements, examples, and the question.

When implementing the cold-start dataset, the first step is to determine the contents of these key variables. `mercaptionplus_dataset.py` already defines the candidates as `['description', 'ovlabel']`. Since both fields need to be read during cold start, we can add a new label type: `description_and_ovlabel`, together with a corresponding reader function.

The data loading entry point is:

```python
cur_label_type = self.get_cur_label_type(self.label_type_candidates, self.label_type)
qa_pair = self.get_qa_pairs(self.dataset, cur_label_type, sample)
```

The first step is to verify that the label type is valid, meaning that it is included in the candidates. Therefore, the new type should first be added in `mercaptionplus_dataset.py`:

```python
self.label_type_candidates = ['description', 'ovlabel', 'description_and_ovlabel']
```

`self.label_type` is determined by the YAML configuration:

```yaml
datasets:
  mercaptionplus:
    data_type: video
    face_or_frame: 'multiface_audio_face_text'
    label_type: 'description_and_ovlabel'
```

After `cur_label_type` is obtained, the code enters `get_qa_pairs`. The existing MERCaption+ branch is not suitable for the SFT setting here, so a new `mercaptionplus_sft` branch should be added:

```python
elif dataset in ['MERCaptionPlus-SFT']:
	candidates = {
		'description_and_ovlabel': self.func_get_description_and_ovlabel(sample),
	}
```

This branch calls a new function that concatenates `description` and `ovlabel`:

```python
def func_get_description_and_ovlabel(self, sample):
	description = sample['description']
	ovlabel = sample['ovlabel']
	ensembled_answer = f'<think> {description} </think> <answer> {ovlabel} </answer>'
	question = 'Please recognize emotional states of the character. Output the thinking process in <think> </think> and final answer in <answer> </answer> tags.'

	return {
		'question': question,
		'answer': ensembled_answer,
	}
```

## GRPO

### Dataset

The GRPO stage uses the MER2025-OV dataset. The input consists of multimodal data such as video and audio, and the label is an open-vocabulary emotion label.

Therefore, the following branch should be added to `get_qa_label`:

```python
elif dataset in ['MER2025-OV']:
	candidates = {
		'ovlabel': self.func_get_qa_ovlabel(sample),
	}
```

### Prompt Embedding Construction: `_build_prompt_inputs_embeds()`

On the input side, the first step is to construct the prompt embedding sequence. The multimodal encoding part directly reuses the original AffectGPT implementation:

```python
if "frames" in samples:
    frame_hiddens, frame_llms = self.encode_video_merge(samples["frames"], samples["raw_frames"])
if "faces"  in samples:
    face_hiddens,  face_llms  = self.encode_video_merge(samples["faces"],  samples["raw_faces"])
if "audios" in samples:
    audio_hiddens, audio_llms = self.encode_audio_merge(samples["audios"], samples["raw_audios"])
if "images" in samples:
    image_hiddens, image_llms = self.encode_image_merge(samples["images"], samples["raw_images"])

if (samples["input_ids"][0] == self.MULTI_PATCH_TOKEN_ID).sum() != 0:
    if self.face_or_frame.startswith("multiface"):
        multi_hiddens, multi_llms = self.encode_multi_merge(face_hiddens,  audio_hiddens)
    elif self.face_or_frame.startswith("multiframe"):
        multi_hiddens, multi_llms = self.encode_multi_merge(frame_hiddens, audio_hiddens)
```

After the embeddings for each modality are obtained, the placeholder tokens in the prompt must be replaced with the real multimodal features. In general, the dataset prompt is a template, and multimodal data is represented by placeholders, for example:

```python
# Results after adding <Multi> tokens
elif face_or_frame == 'multiface_text': # (multi, text)
    assert subtitle is not None
    prompt = f"###Human: The audio and video merged info is: <Multi><MultiHere></Multi>. " \
            + f"The subtitle of this video is: <Subtitle>{subtitle}</Subtitle>. " \
            + f"Now, please answer my question based on all the provided information. {user_message} ###Assistant: "
elif face_or_frame == 'multiface_audio_face_text': # (multi, face, audio, text)
```

The placeholders are then replaced to obtain the complete multimodal embedding input. One important detail is that when calling LLaMA's `embed_tokens()`, the input must consist of valid vocabulary token IDs. Multimodal patch token IDs may not belong to the original LLaMA vocabulary. Looking them up directly may either go out of range or produce meaningless vectors.

Therefore, the code first copies `input_ids` into `temp_input_ids`, temporarily replaces these special patch tokens with `0`, and then feeds the result into the LLaMA embedding layer:

```python
input_ids = samples["input_ids"]
temp_input_ids = copy.deepcopy(input_ids)
for tid in (self.FRAME_PATCH_TOKEN_ID, self.FACE_PATCH_TOKEN_ID, self.AUDIO_PATCH_TOKEN_ID, self.MULTI_PATCH_TOKEN_ID, self.IMAGE_PATCH_TOKEN_ID):
	temp_input_ids[temp_input_ids == tid] = 0
	temp_input_embedding = self.llama_model.model.model.embed_tokens(temp_input_ids)
```

Next, the original `input_ids` are traversed to locate the patch token positions, and the temporary embedding segments are replaced with the real multimodal features:

```python
for cur_input_ids, cur_input_embeds in zip(input_ids, temp_input_embedding):
	for (patch_token_id, query_token_number, embeds) in [
		(self.FRAME_PATCH_TOKEN_ID, self.num_video_query_token, frame_llms),
		(self.FACE_PATCH_TOKEN_ID,  self.num_video_query_token, face_llms),
		(self.AUDIO_PATCH_TOKEN_ID, self.num_audio_query_token, audio_llms),
		(self.MULTI_PATCH_TOKEN_ID, self.num_multi_query_token, multi_llms),
		(self.IMAGE_PATCH_TOKEN_ID, self.num_image_query_token, image_llms),
            ]:
                if (cur_input_ids == patch_token_id).sum() != 0:
                    assert embeds is not None, f"Missing modality input for token {patch_token_id}."
                    cur_features = embeds[cur_idx]
                    masked_indices = torch.where(cur_input_ids == patch_token_id)[0]
                    mask_index_start = masked_indices[0]
                    cur_input_embeds = torch.cat((
                        cur_input_embeds[:mask_index_start],
                        cur_features,
                        cur_input_embeds[mask_index_start + query_token_number:],
                    ), dim=0)
            new_input_embeds.append(cur_input_embeds)
            cur_idx += 1
```

Finally, the function returns the prompt embeddings and the mask. Since samples in the same batch may have different lengths, padding is required. The mask indicates which positions are valid tokens and which positions are padding.

```python
prompt_embeds = torch.stack(new_input_embeds, dim=0)         # [B, L_p, D]
prompt_mask   = samples["attention_masks"]                   # [B, L_p]
return prompt_embeds, prompt_mask
```

### Within-Group Sampling: `rollout_group()`

The first step of GRPO is to sample multiple times under the same prompt, producing a group of candidate responses.

First, the prompt embeddings and mask are copied `G` times, where `G` is the group size. Then the model is called for sampling:

```python
rep_embeds = prompt_embeds.expand(group_size, -1, -1)
rep_mask   = prompt_mask.expand(group_size, -1)

out = self.llama_model.generate(
	inputs_embeds=rep_embeds,
	attention_mask=rep_mask,
	max_new_tokens=cfg["max_new_tokens"],
	do_sample=True,
	temperature=cfg["sample_temperature"],
	top_p=cfg["sample_top_p"],
	top_k=cfg["sample_top_k"],
	num_return_sequences=1,
	pad_token_id=self.llama_tokenizer.pad_token_id,
	return_dict_in_generate=True,
)
```

The returned data is then read:

```python
gen_ids  = out.sequences                          # [G, L_g]
pad_id   = self.llama_tokenizer.pad_token_id
eos_id   = self.llama_tokenizer.eos_token_id
```

Note that because generation receives `inputs_embeds` rather than `input_ids`, `gen_ids` contains only the newly generated content and does not include the original prompt.

The mask corresponding to `gen_ids` is then constructed:

```python
# Construct the mask: pad positions = 0, all others = 1
gen_mask = (gen_ids != pad_id).long()
# If EOS appears, set positions after EOS to 0 as well.
# HuggingFace should already have padded them, but this is a defensive pass.
if eos_id is not None:
	for i in range(gen_ids.size(0)):
		eos_pos = (gen_ids[i] == eos_id).nonzero(as_tuple=False)
		if eos_pos.numel() > 0:
			cut = eos_pos[0].item() + 1 # Keep log probability for the EOS step
			gen_mask[i, cut:] = 0
```

The generated text is then decoded:

```python
gen_text = [
	self.llama_tokenizer.decode(gen_ids[i], skip_special_tokens=True)
	for i in range(gen_ids.size(0))
]
return gen_ids, gen_mask, gen_text
```

### Token-Level Log Probability Computation: `_compute_logprobs()`

`generate()` is HuggingFace's high-level inference and decoding interface. Its goal is to generate tokens efficiently. GRPO training, however, requires a controllable and differentiable log-probability computation process that is not affected by the sampling strategy. Therefore, a separate function is needed to recompute `logp`.

The process is similar to standard autoregressive computation. First, the prompt is copied. Then the generated `token_ids` are converted into embeddings. The token embeddings and token mask are concatenated after the prompt to obtain the full input sequence. LLaMA is then called for inference, and autoregressive computation is handled inside the model. After the logits are obtained, the generated portion is sliced out, `log_softmax` is computed, and `gather` is used to select the log probability of the actually generated token from the full vocabulary distribution.

### GRPO Loss Computation: `_grpo_loss()`

`_grpo_loss()` computes the policy-gradient loss according to the GRPO objective. It mainly includes within-group advantage normalization, importance-ratio computation, the clipped surrogate objective, and masked sequence aggregation.

First, the within-group advantage is normalized:

```python
adv = (rewards - rewards.mean()) / (rewards.std(unbiased=False) + 1e-8)   # [G]
adv = adv.detach().to(logp_new.dtype) # Gradients only flow through log probability
adv_b = adv.view(-1, 1).expand_as(logp_new) # [G, L_g]
```

Then the importance ratio is computed:

```python
ratio = (logp_new - logp_old.detach()).exp() # [G, L_g]
surr1 = ratio * adv_b
surr2 = ratio.clamp(1.0 - clip_eps, 1.0 + clip_eps) * adv_b
pg    = torch.min(surr1, surr2) # [G, L_g]
```

Finally, the loss is computed:

```python
mask_f = mask.to(pg.dtype)
if normalization == "token_mean":
	denom = mask_f.sum().clamp_min(1.0)
	loss  = -(pg * mask_f).sum() / denom
else: # 'seq_mean': first average within each sequence, then average across the batch
	seq_lens = mask_f.sum(dim=1).clamp_min(1.0)
	seq_loss = -(pg * mask_f).sum(dim=1) / seq_lens
	loss     = seq_loss.mean()
```

The mask is first converted to the same dtype as the policy-gradient tensor to make later computation easier. The loss supports two normalization modes. The first is `token_mean`, which averages the gradient contribution over all valid tokens. The second is `seq_mean`, which first averages over valid tokens within each sequence and then averages across the `G` sequences. Note that a negative sign is added before the loss because the optimization objective is to maximize the policy-gradient term.

### RL Training Entry Point

The RL training entry point for GRPO is shared with SFT. Both start from `main` in `train.py`. The overall call chain is:

```text
train.py::main()
  └─ RunnerBase.train()           # Epoch loop
       └─ RunnerBase.train_epoch()
            └─ BaseTask.train_epoch()   # Iteration loop
                 └─ BaseTask.train_step()
                      └─ model(samples)["loss"]   # Actually enters RL here
                           └─ AffectGPTR1.forward()
```

The core code is in `affectgpt_r1.py`:

```python
    def forward(self, samples: Dict):
        ...
        # ---- 1) prompt -> embedding ----
        prompt_embeds, prompt_mask = self._build_prompt_inputs_embeds(samples)

        # ---- 2) sample G responses from the old policy ----
        if self._old_policy_state is None:
            self.snapshot_old_policy()
        ...
        gen_ids, gen_mask, gen_text = self._rollout_group(...)

        # ---- 3) compute rewards ----
        reward_dict = rwd_mod.compute_group_rewards(...)

        # ---- 4) logp_old from the old policy, no grad ----
        backup = self._swap_with_old_policy()
        logp_old = self._compute_logprobs(..., no_grad=True)
        self._restore_from_backup(backup)

        # ---- 5) logp_new from the current policy, with gradients ----
        logp_new = self._compute_logprobs(..., no_grad=False)

        # ---- 6) GRPO loss ----
        loss, metrics = self._grpo_loss(...)

        self.snapshot_old_policy()  # Used in the next step
        return {"loss": loss, "metrics": metrics}
```

The concrete flow of the function has already been explained above.

### Reward Design

The reward module first defines a set of shared utility functions. The following two regular expressions are used in `parse_response()` to extract the thinking segment and the answer segment:

```python
_THINK_RE  = re.compile(r"<think>\s*(.*?)\s*</think>",   re.DOTALL | re.IGNORECASE)
_ANSWER_RE = re.compile(r"<answer>\s*(.*?)\s*</answer>", re.DOTALL | re.IGNORECASE)

def parse_response(response: str) -> Dict[str, Optional[str]]:
    think_match  = _THINK_RE.search(response)
    answer_match = _ANSWER_RE.search(response)
    return {
        "think":  think_match.group(1).strip()  if think_match  else None,
        "answer": answer_match.group(1).strip() if answer_match else None,
    }
```

`parse_emotion_words()` parses the comma-separated string inside `<answer>` into a list of emotion words.

```python
def parse_emotion_words(text: Optional[str]) -> List[str]:
    if not text:
        return []
    words = string_to_list(text)
    words = [w.lower().strip() for w in words if w and w.strip()]
    # Deduplicate while preserving order
    seen, out = set(), []
    for w in words:
        if w not in seen:
            seen.add(w)
            out.append(w)
    return out
```

`extract_emotion_words_from_think()` extracts emotion words that appear in the model's `<think>` text. These words are later used by the alignment reward, dual reward, and other reward computations:

```python
def extract_emotion_words_from_think(think_text: Optional[str]) -> List[str]:
    if not think_text:
        return []
    text = think_text.lower()
    found, used_spans = [], []
    for w in _EMOTION_VOCAB:                    # Already sorted by descending length
        # Match whole-word boundaries to avoid counting "happy" inside "unhappy"
        for m in re.finditer(r"\b" + re.escape(w) + r"\b", text):
            span = (m.start(), m.end())
            # Check whether this span has already been occupied by a longer word
            if any(s < span[1] and span[0] < e for s, e in used_spans):
                continue
            used_spans.append(span)
            found.append(w)
    # Deduplicate while preserving order
    seen, out = set(), []
    for w in found:
        if w not in seen:
            seen.add(w)
            out.append(w)
    return out
```

#### EW-Based Reward

`_ew_f1()` computes the matching quality between predicted emotion words `pred_words` and ground-truth emotion words `gt_words`, and returns the average F1 score. Specifically, it iterates over each emotion wheel and uses `calculate_openset_overlap_rate()` to map the ground-truth and predicted emotion words into unified emotion-wheel categories. It then computes the overlap rate between the two sets and returns `(precision, recall)`.

#### Length Penalty

`length_penalty()` penalizes cases where the number of predicted emotion words is clearly larger than the number of ground-truth words. If the prediction is not longer than the ground truth, no penalty is applied. The function provides three penalty strengths:

```python
def length_penalty(n_pred: int, n_gt: int, mode: str = "P3") -> float:
    """Three decay strengths: P1 is the strictest, P3 is the loosest. The paper recommends P2 / P3."""
    if n_pred <= n_gt or n_pred <= 0:
        return 1.0
    if mode == "P1":   # 1 / (|o_a| - |y| + 1)
        return 1.0 / (n_pred - n_gt + 1)
    if mode == "P2":   # |y| / |o_a|
        return float(n_gt) / float(n_pred)
    if mode == "P3":   # log(|y|) / log(|o_a|)
        if n_gt <= 1:
            return 1.0 / math.log(max(n_pred, 2))
        return math.log(n_gt) / math.log(n_pred)
    raise ValueError(f"Unknown length penalty mode: {mode}")
```

#### Format Reward

`format_reward` constrains the model's output format. If the response contains both non-empty `<think>` and `<answer>` fields, the reward is `1`; otherwise, it is `0`.

```python
def format_reward(response: str, **_) -> float:
    parts = parse_response(response)
    return 1.0 if parts["think"] and parts["answer"] else 0.0
```

#### Accuracy Reward

`accuracy_reward` evaluates the correctness of the final answer. It first parses the model output with `parse_response()` and `parse_emotion_words()`, and normalizes the emotion words to lowercase. It then calls `_ew_f1()` to compute the matching score between the predicted emotion words and the ground truth. If `length_penalty_mode` is enabled, the score is further multiplied by the length-penalty coefficient.

```python
parts  = parse_response(response)
o_a    = parse_emotion_words(parts["answer"])
gt     = [w.lower().strip() for w in gt_words if w]
if len(o_a) == 0 or len(gt) == 0:
	return 0.0
score  = _ew_f1(o_a, gt)
if length_penalty_mode is not None:
	score *= length_penalty(len(o_a), len(gt), mode=length_penalty_mode)
return score
```

#### Alignment Reward

`alignment_reward()` computes a consistency reward between the "thinking process" and the "final answer". The overall process is similar to `accuracy_reward`, but the comparison is between the emotion words in `think` and those in `answer`. This reward is binary: `1` means consistent, and `0` means inconsistent.

```python
def alignment_reward(
    response: str,
    similarity_threshold: float = 0.5,
    **_,
) -> float:
    parts = parse_response(response)
    e_t   = extract_emotion_words_from_think(parts["think"])
    o_a   = parse_emotion_words(parts["answer"])
    if len(e_t) == 0 or len(o_a) == 0:
        return 0.0
    sim   = _ew_f1(e_t, o_a)
    return 1.0 if sim >= similarity_threshold else 0.0
```

#### Dual Reward

`dual_reward` is computed similarly to `accuracy_reward`, but it evaluates the emotion words extracted from the reasoning text `think` rather than the final answer `answer`. It measures consistency between thinking and the ground truth.

```python
def dual_reward(
    response: str,
    gt_words: Sequence[str],
    length_penalty_mode: Optional[str] = "P3",
    **_,
) -> float:
    """Eq.9 + Eq.15: P_k(e_t, y) * EW(e_t, y), computed as accuracy over emotion words extracted from thinking."""
    parts = parse_response(response)
    e_t   = extract_emotion_words_from_think(parts["think"])
    gt    = [w.lower().strip() for w in gt_words if w]
    if len(e_t) == 0 or len(gt) == 0:
        return 0.0
    score = _ew_f1(e_t, gt)
    if length_penalty_mode is not None:
        score *= length_penalty(len(e_t), len(gt), mode=length_penalty_mode)
    return score
```

#### Perception Reward

`perception_reward` supervises whether the model-generated emotional reasoning and final output are consistent with the input video `v`. First, a pairwise win matrix is built. For every pair of responses in the group, a perceptual-consistency comparison is performed and the preference result is recorded.

```python
wins = np.zeros((G, G), dtype=np.float64)
for i in range(G):
	for j in range(i + 1, G):
		p = judge_fn(video_path, responses[i], responses[j])
		wins[i, j] += p
		wins[j, i] += 1 - p
```

Next, these pairwise preferences are fed into the Bradley-Terry algorithm to obtain a ranking of the group outputs.

```python
pi = np.ones(G) / G
for _ in range(50):
	new_pi = np.zeros_like(pi)
	for i in range(G):
		num = wins[i].sum()
		den = sum((wins[i, j] + wins[j, i]) / (pi[i] + pi[j] + 1e-12) for j in range(G) if j != i)
		new_pi[i] = num / (den + 1e-12)
	new_pi /= new_pi.sum() + 1e-12
	if np.allclose(new_pi, pi, atol=1e-6):
		break
	pi = new_pi
```

Finally, the top 50% responses in the ranking are assigned `reward = 1`, while the remaining responses receive `reward = 0`.

```python
top_k = max(1, int(np.ceil(G * 0.5)))
ranked = np.argsort(-pi)
rewards = np.zeros(G, dtype=np.float64)
rewards[ranked[:top_k]] = 1.0
```
