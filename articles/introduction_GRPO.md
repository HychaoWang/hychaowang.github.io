---
slug: "grpo"
articleId: "article-001"
language: "en"
title: "An Brief Introduction to GRPO"
date: "2026-07-02"
author: "Haichao Wang"
tags: ["llm", "reinforcement-learning", "grpo"]
visibility: "public"
abstract: "A practical introduction to Group Relative Policy Optimization (GRPO), covering why it removes the critic from PPO-style LLM training, how group-relative advantages are computed, and how to implement the core idea with TRL and PyTorch."
---

Large language model training has gradually moved from a simple "pretraining plus supervised fine-tuning" pipeline toward a richer post-training stack. Pretraining gives the model broad linguistic and factual ability. Supervised fine-tuning teaches it to follow instructions. Reinforcement learning then pushes the model toward task-specific objectives: more accurate answers, more reliable reasoning, stricter formatting, or better alignment with preferences.

Group Relative Policy Optimization, usually abbreviated as **GRPO**, belongs to this post-training family. It was introduced in the DeepSeekMath paper as a PPO-style reinforcement learning algorithm for mathematical reasoning. The key design choice is simple but important: GRPO removes the separate value model, or critic, and estimates the baseline from a group of sampled answers instead.

This article explains GRPO from three angles:

1. why it is useful for reasoning-heavy LLM training;
2. how the objective works mathematically;
3. how to implement the idea with Hugging Face TRL and a minimal PyTorch loss.

## 1. Why GRPO Exists

To understand GRPO, it helps to start with PPO, or Proximal Policy Optimization. PPO is a classic policy optimization algorithm. Its central idea is to update a policy without letting the new policy move too far away from the old one in a single step. It does this through a clipped surrogate objective.

In LLM reinforcement learning, a simplified PPO-style loop looks like this:

1. sample a prompt;
2. generate one or more completions with the current policy;
3. score each completion with a reward model, verifier, or rule-based reward;
4. estimate the advantage;
5. update the policy while controlling policy drift, often with a KL penalty against a reference model.

The expensive part is advantage estimation. Standard PPO commonly uses a value model, also called a critic, to estimate how good the current state is. For language models, this can mean adding a value head or maintaining another large model. That increases memory use, engineering complexity, and training instability.

GRPO asks a different question: if we already generate multiple answers for the same prompt, can we use those answers to define a relative baseline?

Instead of asking, "How good is this answer compared with an absolute value estimate?", GRPO asks, "How good is this answer compared with the other answers generated for the same prompt?"

That is the "group relative" part of the algorithm.

## 2. The Core GRPO Loop

Assume we have a prompt $q$. The old policy is $\pi_{\theta_{\mathrm{old}}}$, the current trainable policy is $\pi_\theta$, and the reference policy is $\pi_{\mathrm{ref}}$.

For each prompt, GRPO samples a group of $G$ completions:

$$
\{o_1, o_2, \dots, o_G\} \sim \pi_{\theta_{\mathrm{old}}}(\cdot \mid q)
$$

Here, $G$ is the group size. In practice it might be 4, 8, 16, or another value depending on memory and throughput.

Each completion receives a reward:

$$
r_i = R(q, o_i)
$$

The reward can come from a learned reward model, a rule-based verifier, unit tests, exact-answer matching, format checks, or a weighted combination of several signals.

GRPO then computes a group-normalized advantage:

$$
\mu = \frac{1}{G}\sum_{j=1}^{G} r_j
$$

$$
\sigma = \sqrt{\frac{1}{G}\sum_{j=1}^{G}(r_j - \mu)^2}
$$

$$
A_i = \frac{r_i - \mu}{\sigma + \epsilon}
$$

The result is an advantage estimate for each completion:

* if $A_i > 0$, completion $o_i$ is better than the group average;
* if $A_i < 0$, completion $o_i$ is worse than the group average;
* if $A_i \approx 0$, completion $o_i$ is close to the group average.

This is the main difference from critic-based PPO. PPO usually learns a value function. GRPO uses the rewards of sibling completions for the same prompt.

## 3. The GRPO Objective

GRPO keeps the PPO intuition that policy updates should be bounded. For each generated token, define the probability ratio:

$$
\rho_{i,t}(\theta)
=
\frac{
\pi_\theta(o_{i,t} \mid q, o_{i,<t})
}{
\pi_{\theta_{\mathrm{old}}}(o_{i,t} \mid q, o_{i,<t})
}
$$

If the current policy assigns a higher probability to a token than the old policy, $\rho_{i,t}$ is greater than 1. If it assigns a lower probability, the ratio is below 1.

The PPO-style clipped objective is:

$$
\min \left(
\rho_{i,t} A_i,
\operatorname{clip}(\rho_{i,t}, 1-\epsilon, 1+\epsilon) A_i
\right)
$$

When $A_i$ is positive, the model is encouraged to increase the probability of tokens in that completion. When $A_i$ is negative, it is encouraged to decrease them. The clipping term prevents the update from becoming too aggressive.

LLM training also usually includes a KL penalty against a reference model:

$$
D_{\mathrm{KL}}\left(\pi_\theta \,\|\, \pi_{\mathrm{ref}}\right)
$$

A common GRPO maximization objective can be written as:

$$
J_{\mathrm{GRPO}}(\theta)
=
\mathbb{E}
\left[
\frac{1}{G}
\sum_{i=1}^{G}
\frac{1}{|o_i|}
\sum_{t=1}^{|o_i|}
\left(
\min\left(
\rho_{i,t}\hat A_i,
\operatorname{clip}(\rho_{i,t}, 1-\epsilon, 1+\epsilon)\hat A_i
\right)
-
\beta
D_{\mathrm{KL}}
\left(
\pi_\theta \,\|\, \pi_{\mathrm{ref}}
\right)
\right)
\right]
$$

Here:

* $\hat A_i$ is the group-normalized advantage for completion $i$;
* $\rho_{i,t}$ is the token-level importance ratio;
* $\epsilon$ controls the clipping range;
* $\beta$ controls the strength of the KL penalty.

The reward term moves the model toward better completions. The KL term prevents the model from drifting too far from the reference policy. If we write the objective as a loss to minimize, the sign flips:

$$
\mathcal{L}_{\mathrm{GRPO}}(\theta)
=
-
J_{\mathrm{GRPO}}(\theta)
$$

## 4. Why GRPO Fits Reasoning Tasks

GRPO is especially natural for math, code, and structured reasoning tasks because these tasks often have **verifiable rewards**.

For example:

* math: whether the final answer is correct;
* code: whether generated code passes unit tests;
* formatting: whether the output satisfies XML, JSON, or a regular expression;
* symbolic reasoning: whether the final expression or proof step matches a verifier;
* instruction following: whether required fields or constraints are present.

These rewards do not always require human preference labels or a separately trained reward model. If a prompt can produce multiple candidate answers, a verifier can rank or score those candidates. GRPO turns that within-prompt comparison into a training signal.

This is why GRPO became important in reasoning-oriented post-training. It is not magic by itself; it is useful because many reasoning tasks can be scored more objectively than open-ended dialogue quality.

## 5. A Small Example

Suppose the prompt is:

```text
Compute 23 x 17.
```

The model samples four completions:

```text
o1: 23 x 17 = 391
o2: 23 x 17 = 381
o3: 23 x 17 = 391
o4: 23 x 17 = 401
```

Use a binary reward: 1 for the correct final answer, 0 otherwise.

$$
r = [1, 0, 1, 0]
$$

The group mean is:

$$
\mu = 0.5
$$

The standard deviation is:

$$
\sigma = 0.5
$$

The normalized advantages are:

$$
A = [1, -1, 1, -1]
$$

GRPO will increase the probability of completions like $o_1$ and $o_3$, and decrease the probability of completions like $o_2$ and $o_4$. No critic is needed. The model learns from relative quality within the group.

## 6. Quick Start with Hugging Face TRL

The easiest way to try GRPO today is Hugging Face TRL's `GRPOTrainer`, which implements GRPO-style training for language models.

Install the required packages:

```bash
pip install -U transformers datasets accelerate trl
```

A minimal training script looks like this:

```python
# train_grpo.py
from datasets import load_dataset
from trl import GRPOConfig, GRPOTrainer
from trl.rewards import accuracy_reward

dataset = load_dataset("trl-lib/DeepMath-103K", split="train")

training_args = GRPOConfig(
    output_dir="qwen-grpo-math",
    per_device_train_batch_size=1,
    gradient_accumulation_steps=8,
    num_generations=4,          # group size: completions per prompt
    max_prompt_length=512,
    max_completion_length=512,
    learning_rate=1e-6,
    logging_steps=10,
    save_steps=200,
)

trainer = GRPOTrainer(
    model="Qwen/Qwen2.5-0.5B-Instruct",
    reward_funcs=accuracy_reward,
    args=training_args,
    train_dataset=dataset,
)

trainer.train()
```

Run it with:

```bash
accelerate launch train_grpo.py
```

This script is useful for understanding the workflow, but real training still needs careful resource planning. For learning, start with a small model, short completions, a small dataset slice, and a small `num_generations`.

## 7. Writing a Custom Reward Function

In many applications, the most important part of GRPO is not the optimizer; it is the reward function.

Suppose we want the model to output an answer inside `<answer>...</answer>`, and we want to reward both format compliance and correctness:

```python
import re

def format_and_accuracy_reward(completions, answer, **kwargs):
    rewards = []

    for completion, gold in zip(completions, answer):
        text = completion[0]["content"] if isinstance(completion, list) else completion

        format_ok = bool(re.search(r"<answer>.*?</answer>", text, re.S))

        match = re.search(r"<answer>(.*?)</answer>", text, re.S)
        pred = match.group(1).strip() if match else ""

        correct = pred == str(gold).strip()

        reward = 0.0
        if format_ok:
            reward += 0.2
        if correct:
            reward += 0.8

        rewards.append(reward)

    return rewards
```

Then pass it into `GRPOTrainer`:

```python
trainer = GRPOTrainer(
    model="Qwen/Qwen2.5-0.5B-Instruct",
    reward_funcs=format_and_accuracy_reward,
    args=training_args,
    train_dataset=dataset,
)
```

This is the engineering appeal of GRPO: complex behavior can often be decomposed into reward terms. You can combine correctness, format validity, length control, tool-use success, refusal behavior, and domain-specific constraints.

The hard part is that the model will optimize exactly what you reward, not necessarily what you meant. A sloppy reward can produce reward hacking.

## 8. A Minimal PyTorch GRPO Loss

The following function is not a production trainer. It is a compact implementation for understanding the core mechanics:

```python
import torch

def grpo_loss(
    logp,        # [B, G, T], log prob under current policy
    old_logp,    # [B, G, T], log prob under old policy
    ref_logp,    # [B, G, T], log prob under reference policy
    rewards,     # [B, G], scalar reward for each completion
    mask,        # [B, G, T], 1 for real tokens, 0 for padding
    clip_eps=0.2,
    beta=0.01,
    adv_eps=1e-6,
):
    # 1. Group-relative advantage.
    mean = rewards.mean(dim=1, keepdim=True)
    std = rewards.std(dim=1, keepdim=True)
    adv = (rewards - mean) / (std + adv_eps)  # [B, G]

    # 2. Broadcast completion-level advantages to tokens.
    adv = adv.unsqueeze(-1)  # [B, G, 1]

    # 3. PPO-style probability ratio.
    ratio = torch.exp(logp - old_logp)

    unclipped = ratio * adv
    clipped = torch.clamp(ratio, 1 - clip_eps, 1 + clip_eps) * adv
    policy_obj = torch.minimum(unclipped, clipped)

    # 4. Simple token-level KL proxy against the reference policy.
    kl = logp - ref_logp

    # 5. Maximize policy_obj - beta * kl by minimizing its negative.
    token_loss = -(policy_obj - beta * kl)

    # 6. Ignore padding tokens.
    loss = (token_loss * mask).sum() / mask.sum().clamp_min(1.0)

    return loss
```

This captures the essential structure:

* compute group-relative advantages;
* compute an importance ratio against the old policy;
* clip the ratio in PPO style;
* add a reference-policy KL penalty;
* mask out padding tokens.

Real trainers also handle generation, batching, distributed training, mixed precision, reference-model inference, reward aggregation, logging, checkpointing, and sequence-length normalization.

## 9. Practical Pitfalls

**Small group sizes can be noisy.** If $G$ is too small, the group statistics are unstable. With only two completions, the signal can be sharp but brittle.

**Binary rewards are often sparse.** If every completion gets 0, the normalized advantage may provide little useful learning signal. If every completion gets 1, the group cannot distinguish better from worse answers. Dense auxiliary rewards can help.

**Reward design dominates the outcome.** GRPO is an optimizer. The reward defines the behavior. If the reward overvalues format, the model may learn beautiful wrappers around wrong answers. If it overvalues short answers, reasoning may collapse.

**KL strength matters.** A large KL coefficient can prevent learning. A small KL coefficient can allow the model to drift, repeat, exploit the reward, or degrade general language ability.

**Long completions are expensive.** GRPO samples multiple completions per prompt, so memory and latency scale with group size and completion length.

**Off-policy details matter.** The ratio compares current and old policy probabilities. If the sampling policy, training policy, and reference policy are not handled carefully, the objective can become unstable.

## 10. Summary

GRPO can be understood as **PPO without a learned critic**. It keeps PPO's clipped policy update, but replaces critic-based advantage estimation with group-relative reward normalization. For each prompt, the model generates several completions, scores them, normalizes the rewards inside the group, and updates the policy toward the better completions.

This makes GRPO attractive for reasoning tasks where candidate answers can be verified automatically. It reduces the memory and complexity of maintaining a value model, and it maps naturally to math, code, and structured-output training.

The main lesson is practical: GRPO is only as good as the reward signal. The algorithm gives the model a way to learn from relative comparisons, but reward functions, sampling strategy, group size, KL control, and data quality determine whether the training actually improves reasoning.

## References

* [DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models](https://arxiv.org/abs/2402.03300)
* [Hugging Face TRL: GRPO Trainer](https://huggingface.co/docs/trl/en/grpo_trainer)
