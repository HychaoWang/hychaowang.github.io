---
slug: "affectgpt-r1-zh"
articleId: "article-003"
language: "zh"
title: "AffectGPT-R1 的实现"
author: "Haichao Wang"
tags: ["affectgpt", "multimodal", "reinforcement-learning"]
---

## Cold Start
冷启动阶段使用大规模、粗粒度的描述性情绪数据，使模型先获得基础的多模态情绪理解能力和输出格式对齐能力，并为后续强化学习阶段在高质量、细粒度 OV-MER 数据上的奖励计算和策略更新提供稳定初始化。

冷启动使用 MERCaption+ 数据集。该数据集提供了额外的 description 字段，可以作为 thinking 部分的监督信号。

模型输入包括视频内容和用户指令。视频内容包含视觉、声音以及文本/字幕信息；用户指令要求模型识别角色的情绪状态，并按照固定格式输出。与原始 AffectGPT 只输出情绪词不同，AffectGPT-R1 在冷启动阶段要求模型输出两部分：一部分放在 <think>...</think> 中，表示情绪推理过程；另一部分放在 <answer>...</answer> 中，表示最终的开放词汇情绪标签。

因此，在自回归 teacher forcing 阶段，训练目标需要从单一情绪标签改为由 description 和 answer 拼接而成的结构化输出，数据读取和 QA 构造逻辑也需要同步调整。

在 `base_dataset.py` 中，有几个关键变量：
1. `label_type_candidates`：数据集支持的 label type 列表，和具体数据集有关。例如，`ovmerd_dataset.py` 中定义了 `['description', 'ovlabel']`。
2. `label_type`：来自数据集配置 `dataset_cfg.label_type`，决定当前数据集样本的标注形式。如果设置为 `hybrid`，则每次从 candidates 中随机选择。
3. `question`：用于指明当前任务，通常在 `get_qa` 系列函数中定义。
4. `prompt`：实际喂给模型的完整输入文本，可能包含指令、上下文、格式要求、示例以及 question。

实现冷启动数据集时，需要先确定几个关键变量的内容。`mercaptionplus_dataset.py` 中已经定义了 candidates 为 `['description', 'ovlabel']`。由于这两个字段在 cold start 中都需要读取，因此可以新增一个 label type：`description_and_ovlabel`，并为它实现配套的读取函数。

数据读取的入口在：
```python
cur_label_type = self.get_cur_label_type(self.label_type_candidates, self.label_type)
qa_pair = self.get_qa_pairs(self.dataset, cur_label_type, sample)
```
第一步是确认 label type 的合法性，即判断它是否在 candidates 中。因此，需要先在 `mercaptionplus_dataset.py` 中加入新的 type：`self.label_type_candidates = ['description', 'ovlabel', 'description_and_ovlabel']`。`self.label_type` 则由 YAML 配置决定：
```yaml
datasets:
  mercaptionplus:
    data_type: video
    face_or_frame: 'multiface_audio_face_text'
    label_type: 'description_and_ovlabel' 
```
得到 `cur_label_type` 后，代码会进入 `get_qa_pairs`。这里原本已有 mercaptionplus 的条件分支，但它与 SFT 模式下的需求不同，因此需要新增一个 `mercaptionplus_sft` 分支：
```python
elif dataset in ['MERCaptionPlus-SFT']:
	candidates = {
		'description_and_ovlabel': self.func_get_description_and_ovlabel(sample),
	}
```
这里需要调用一个用于拼接 description 和 ovlabel 的新函数：
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
### 数据集
GRPO 阶段使用 MER2025-OV 数据集。输入为视频、音频等多模态数据，label 为 open-vocabulary 情绪标签。

因此，需要在 `get_qa_label` 函数中加入：
```python
elif dataset in ['MER2025-OV']:
	candidates = {
		'ovlabel': self.func_get_qa_ovlabel(sample),
	}
```

### Prompt Embedding 构建：`_build_prompt_inputs_embeds()`
输入侧首先需要构建 prompt 的 embedding 序列。多模态 encoding 部分直接复用 AffectGPT 的实现：

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
得到各模态对应的 embedding 后，需要将 prompt 中的占位 token 替换为真实的多模态特征。一般情况下，数据集中的 prompt 是模板形式，多模态数据以占位符表示，例如：
```python
## 后面都是增加 <Multi> token 后的结果    
elif face_or_frame == 'multiface_text': # (multi, text)
    assert subtitle is not None
    prompt = f"###Human: The audio and video merged info is: <Multi><MultiHere></Multi>. " \
            + f"The subtitle of this video is: <Subtitle>{subtitle}</Subtitle>. " \
            + f"Now, please answer my question based on all the provided information. {user_message} ###Assistant: "
elif face_or_frame == 'multiface_audio_face_text': # (multi, face, audio, text)
```
随后需要根据占位符完成替换，从而得到完整的多模态 embedding 输入。这里需要注意：调用 LLaMA 的 `embed_tokens()` 时，输入必须是合法的词表 token id。多模态 patch token id 可能不在 LLaMA 原始词表中，直接查 embedding 可能越界或得到无意义的向量。
因此，代码先复制一份 `input_ids` 到 `temp_input_ids`，将这些特殊 patch token 临时替换为 0，再送入 LLaMA embedding 层：
```python
input_ids = samples["input_ids"]
temp_input_ids = copy.deepcopy(input_ids)
for tid in (self.FRAME_PATCH_TOKEN_ID, self.FACE_PATCH_TOKEN_ID, self.AUDIO_PATCH_TOKEN_ID, self.MULTI_PATCH_TOKEN_ID, self.IMAGE_PATCH_TOKEN_ID):
	temp_input_ids[temp_input_ids == tid] = 0
	temp_input_embedding = self.llama_model.model.model.embed_tokens(temp_input_ids)
```

然后遍历原始 `input_ids`，定位 patch token 的位置，并将刚才临时生成的 embedding 片段替换为真正的多模态特征：
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

最后返回 prompt embedding 和 mask。由于 batch 内不同样本长度不一致，需要 padding；mask 的作用就是标记哪些位置是有效 token，哪些位置是 padding。
```python
prompt_embeds = torch.stack(new_input_embeds, dim=0)         # [B, L_p, D]
prompt_mask   = samples["attention_masks"]                   # [B, L_p]
return prompt_embeds, prompt_mask
```

### 组内采样：`rollout_group()`
GRPO 的第一步是在同一 prompt 下进行组内多次采样，得到一组候选响应。
首先，将 prompt embedding 和 mask 复制 G 份，其中 G 为组大小。然后调用模型进行采样：
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
获取返回的数据：
```python
gen_ids  = out.sequences                          # [G, L_g]
pad_id   = self.llama_tokenizer.pad_token_id
eos_id   = self.llama_tokenizer.eos_token_id
```
需要注意的是，由于生成时传入的是 `inputs_embeds` 而不是 `input_ids`，`gen_ids` 是新生成的内容，不包含原始 prompt。

然后生成 `gen_ids` 对应的 mask：
```python
# 构造 mask: pad 位置 = 0, 其余 = 1
gen_mask = (gen_ids != pad_id).long()
# 若 EOS 出现, EOS 之后位置也置 0 (HF 已经填了 pad, 这里再保险一遍)
if eos_id is not None:
	for i in range(gen_ids.size(0)):
		eos_pos = (gen_ids[i] == eos_id).nonzero(as_tuple=False)
		if eos_pos.numel() > 0:
			cut = eos_pos[0].item() + 1 # 保留 EOS 这一步的 logπ
			gen_mask[i, cut:] = 0
```

随后 decode 生成文本：
```python
gen_text = [
	self.llama_tokenizer.decode(gen_ids[i], skip_special_tokens=True)
	for i in range(gen_ids.size(0))
]
return gen_ids, gen_mask, gen_text
```

### Token-level Log Probability 计算：`_compute_logprobs()`
`generate()` 是 HuggingFace 封装好的推理/解码接口，目标是高效地产生 token。GRPO 训练需要的是一个可控、可反传、且不受采样策略改写影响的 logπ 计算过程，因此需要单独实现一个函数来重新计算 logπ。
具体流程与常规自回归计算类似：首先复制 prompt，然后将生成的 `token_ids` 转换为 embedding，最后把 token embedding 和 token mask 拼接到 prompt 后面，得到完整输入序列。随后调用 LLaMA 进行 inference，自回归计算由模型内部完成。得到 logits 后，先裁剪出生成部分，再计算 `log_softmax`，最后通过 `gather` 在完整词表概率分布中取出实际生成 token 对应的 log probability。

### GRPO Loss 计算：`_grpo_loss()`
`_grpo_loss()` 按 GRPO 目标函数计算策略梯度损失，主要包括组内 advantage 归一化、importance ratio 计算、clip surrogate objective 以及 mask 后的序列聚合。
首先进行组内 advantage 归一化：
```python
adv = (rewards - rewards.mean()) / (rewards.std(unbiased=False) + 1e-8)   # [G]
adv = adv.detach().to(logp_new.dtype) # 反向只走 logπ
adv_b = adv.view(-1, 1).expand_as(logp_new) # [G, L_g]
```
然后计算 importance ratio：
```python
ratio = (logp_new - logp_old.detach()).exp() # [G, L_g]
surr1 = ratio * adv_b
surr2 = ratio.clamp(1.0 - clip_eps, 1.0 + clip_eps) * adv_b
pg    = torch.min(surr1, surr2) # [G, L_g]
```
最后计算 loss：
```python
mask_f = mask.to(pg.dtype)
if normalization == "token_mean":
	denom = mask_f.sum().clamp_min(1.0)
	loss  = -(pg * mask_f).sum() / denom
else: # 'seq_mean': 先按序列求均值再 batch 求均值
	seq_lens = mask_f.sum(dim=1).clamp_min(1.0)
	seq_loss = -(pg * mask_f).sum(dim=1) / seq_lens
	loss     = seq_loss.mean()
```
这里需要先将 mask 转成与 policy gradient 相同的 dtype，便于后续计算。loss 支持两种归一化方式：第一种是 `token_mean`，即对所有有效 token 的梯度贡献一起求平均；第二种是 `seq_mean`，即先对每条序列的有效 token 求平均，再对 G 条序列求平均。注意，loss 前需要加负号，因为优化目标是最大化 policy gradient。

### RL 训练入口
GRPO 的 RL 训练入口与 SFT 共用，都从 `train.py` 中的 `main` 开始。整体调用链如下：
```
train.py::main()
  └─ RunnerBase.train()           # 按 epoch 循环
       └─ RunnerBase.train_epoch()
            └─ BaseTask.train_epoch()   # 按 iter 循环
                 └─ BaseTask.train_step()
                      └─ model(samples)["loss"]   # ← 真正进入 RL
                           └─ AffectGPTR1.forward()
```
核心代码在 `affectgpt_r1.py` 中：
```python
    def forward(self, samples: Dict):
        ...
        # ---- 1) prompt → embedding ----
        prompt_embeds, prompt_mask = self._build_prompt_inputs_embeds(samples)

        # ---- 2) 旧策略采样 G 个 response ----
        if self._old_policy_state is None:
            self.snapshot_old_policy()
        ...
        gen_ids, gen_mask, gen_text = self._rollout_group(...)

        # ---- 3) 计算 reward ----
        reward_dict = rwd_mod.compute_group_rewards(...)

        # ---- 4) logp_old (旧策略, no grad) ----
        backup = self._swap_with_old_policy()
        logp_old = self._compute_logprobs(..., no_grad=True)
        self._restore_from_backup(backup)

        # ---- 5) logp_new (当前策略, 有梯度) ----
        logp_new = self._compute_logprobs(..., no_grad=False)

        # ---- 6) GRPO loss ----
        loss, metrics = self._grpo_loss(...)

        self.snapshot_old_policy()  # 下一步用
        return {"loss": loss, "metrics": metrics}
```
上述函数的具体流程已在前文展开说明。

### Reward 设计
Reward 模块首先定义了一组公共工具函数。下面两个正则表达式用于在 `parse_response()` 中抽取 thinking 段和 answer 段：
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
`parse_emotion_words()` 将 `<answer>` 中用逗号分隔的字符串解析为情感词列表。
```python
def parse_emotion_words(text: Optional[str]) -> List[str]:
    if not text:
        return []
    words = string_to_list(text)
    words = [w.lower().strip() for w in words if w and w.strip()]
    # 去重但保持顺序
    seen, out = set(), []
    for w in words:
        if w not in seen:
            seen.add(w)
            out.append(w)
    return out
```
`extract_emotion_words_from_think()` 从模型输出的 `<think>` 思考文本中提取出现过的情感词，供后续 alignment reward 和 dual reward 等奖励计算使用：
```python
def extract_emotion_words_from_think(think_text: Optional[str]) -> List[str]:
    if not think_text:
        return []
    text = think_text.lower()
    found, used_spans = [], []
    for w in _EMOTION_VOCAB:                    # 已按长度倒序
        # 全词边界匹配, 避免抽到 "happy" 时把 "unhappy" 也算进去
        for m in re.finditer(r"\b" + re.escape(w) + r"\b", text):
            span = (m.start(), m.end())
            # 这一段是不是已经被更长的词占用了
            if any(s < span[1] and span[0] < e for s, e in used_spans):
                continue
            used_spans.append(span)
            found.append(w)
    # 去重保序
    seen, out = set(), []
    for w in found:
        if w not in seen:
            seen.add(w)
            out.append(w)
    return out
```
#### EW-based Reward
`_ew_f1()` 用于计算预测情感词 `pred_words` 和真实情感词 `gt_words` 之间的匹配质量，并返回平均 F1 分数。具体来说，它会遍历每个 emotion wheel，并通过 `calculate_openset_overlap_rate()` 将真实情感词和预测情感词映射到统一的 emotion wheel 类别后，计算二者的重叠率，返回 `(precision, recall)`。

#### Length Penalty
`length_penalty()` 用于惩罚预测情感词数量明显多于 ground truth 的情况。如果预测结果不长于 ground truth，则不施加惩罚。该函数提供三种惩罚强度：
```python
def length_penalty(n_pred: int, n_gt: int, mode: str = "P3") -> float:
    """三种衰减强度: P1 最严, P3 最松。论文推荐 P2 / P3。"""
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
`format_reward` 用于约束模型输出格式：当响应同时包含非空的 `<think>` 和 `<answer>` 字段时，奖励为 1；否则奖励为 0。
```python
def format_reward(response: str, **_) -> float:
    parts = parse_response(response)
    return 1.0 if parts["think"] and parts["answer"] else 0.0

```
#### Accuracy Reward
`accuracy_reward` 用于评估最终答案的正确性。它首先通过 `parse_response()` 和 `parse_emotion_words()` 解析模型输出，并将情感词统一转成小写；随后调用 `_ew_f1()` 计算预测情感词与 ground truth 的匹配程度。如果启用了 `length_penalty_mode`，则进一步乘上长度惩罚系数。
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
`alignment_reward()` 计算“思考过程”和“最终答案”之间的一致性奖励。整体流程与 `accuracy_reward` 类似，但比较对象换成了 `think` 和 `answer` 中的情感词。该奖励为二值输出：1 表示一致，0 表示不一致。
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
`dual_reward` 与 `accuracy_reward` 的计算方式类似，但评估对象从最终答案 `answer` 改为推理文本 `think` 中抽取出的情绪词，用于衡量 thinking 与 ground truth 之间的一致性。
```python
def dual_reward(
    response: str,
    gt_words: Sequence[str],
    length_penalty_mode: Optional[str] = "P3",
    **_,
) -> float:
    """Eq.9 + Eq.15:  P_k(e_t, y) * EW(e_t, y) ─ 在 thinking 抽词上算 accuracy。"""
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
`perception_reward` 用于监督模型生成的情绪推理和最终输出是否与输入视频 `v` 一致。首先建立 pairwise win 矩阵，对组内任意两个回答进行感知一致性比较，并记录偏好结果。
```python
wins = np.zeros((G, G), dtype=np.float64)
for i in range(G):
	for j in range(i + 1, G):
		p = judge_fn(video_path, responses[i], responses[j])
		wins[i, j] += p
		wins[j, i] += 1 - p
```
接着，将这些 pairwise preference 输入 Bradley-Terry algorithm，得到这一组输出的排序。
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
最后取排序前 50% 的响应并赋予 `reward = 1`，其余响应的 `reward = 0`。
```python
top_k = max(1, int(np.ceil(G * 0.5)))
ranked = np.argsort(-pi)
rewards = np.zeros(G, dtype=np.float64)
rewards[ranked[:top_k]] = 1.0
```
