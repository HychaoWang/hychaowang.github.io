---
slug: "grpo"
title: "GRPO：研究背景、数学原理与代码实现"
date: "2026-07-02"
author: "Haichao Wang"
tags: ["llm", "reinforcement-learning", "grpo"]
abstract: "介绍 GRPO 的研究背景、核心数学原理与代码实现。"
---

# GRPO：研究背景、数学原理与代码实现

近年来，大语言模型的训练路线逐渐从“预训练 + 指令微调”走向“后训练 + 强化学习”。预训练让模型获得语言和知识能力，监督微调让模型学会遵循指令，而强化学习则进一步把模型推向某种目标：回答更准确、推理更可靠、格式更稳定、行为更符合偏好。GRPO，全称 Group Relative Policy Optimization，即“组相对策略优化”，正是在这个背景下流行起来的一个强化学习算法。

GRPO 最早作为 DeepSeekMath 论文中的关键方法被提出。DeepSeekMath 论文称，DeepSeekMath 7B 在不依赖外部工具和投票技巧的情况下，在 MATH benchmark 上达到 51.7%，64 次 self-consistency 可达到 60.9%，并把其数学推理能力归因于数据工程和 GRPO 两个因素。论文明确把 GRPO 描述为 PPO 的一个变体，目标是在提升数学推理能力的同时降低 PPO 的内存开销。

## 1. 为什么需要 GRPO？

要理解 GRPO，先要理解 PPO。PPO，即 Proximal Policy Optimization，是强化学习中非常经典的策略优化算法。PPO 的核心思想是：不要让新策略一次更新得离旧策略太远，而是用一个裁剪后的 surrogate objective 来稳定训练。PPO 论文指出，它允许对同一批采样数据进行多轮小批量更新，并在实现复杂度、样本效率和训练时间之间取得较好平衡。

在大语言模型的 RLHF 或 RLAIF 训练中，PPO 曾经非常常见。典型流程如下：

1. 给定一个 prompt；
2. 当前语言模型生成回答；
3. 奖励模型或规则函数给回答打分；
4. PPO 根据 reward 更新模型；
5. 同时使用 KL 惩罚，避免模型偏离 reference model 太远。

问题在于，PPO 通常需要一个 value model，也叫 critic，用来估计状态价值并计算 advantage。对于普通强化学习任务，这很自然；但对于大语言模型来说，额外训练一个 critic 代价很高。LLM 本身已经很大，再加一个 value head 或独立 value model，会带来显存、工程复杂度和稳定性问题。

GRPO 的直觉很简单：既然我们可以对同一个问题生成多个回答，那为什么不让这些回答彼此比较？也就是说，不再训练一个 critic 来判断“这个回答比预期好多少”，而是在同一个 prompt 的一组回答中判断“这个回答比同组其他回答好多少”。这就是“Group Relative”的含义。

Hugging Face TRL 文档也把 GRPO 解释为一个 online learning 算法：训练过程中，模型会自己生成数据，然后通过生成 completions、计算 advantage、估计 KL divergence、计算 loss 等步骤迭代优化。

## 2. GRPO 的核心流程

假设我们有一个问题 $q$，当前策略模型是 $\pi_\theta$，旧策略模型是 $\pi_{\theta_{\text{old}}}$，参考模型是 $\pi_{\text{ref}}$。GRPO 对每个问题不是只采样一个回答，而是采样一组回答：

$$
{o_1, o_2, \dots, o_G} \sim \pi_{\theta_{\text{old}}}(\cdot \mid q)
$$

这里 $G$ 是 group size，比如 4、8 或 16。每个回答 $o_i$ 会被奖励函数打分：

$$
r_i = R(q, o_i)
$$

奖励函数可以是一个 reward model，也可以是规则函数。比如数学题可以用最终答案是否正确作为 reward，代码题可以用单元测试通过率作为 reward，格式任务可以用正则表达式检查输出格式。

接下来，GRPO 不使用 value model，而是在同一组回答内部做标准化：

$$
\mu = \frac{1}{G}\sum_{j=1}^{G} r_j
$$

$$
\sigma = \sqrt{\frac{1}{G}\sum_{j=1}^{G}(r_j - \mu)^2}
$$

$$
A_i = \frac{r_i - \mu}{\sigma + \epsilon}
$$

这个 $A_i$ 就是第 $i$ 个回答的 advantage。它的含义是：这个回答比同组平均水平好多少。如果 $A_i > 0$，说明它比同组平均回答更好；如果 $A_i < 0$，说明它更差；如果接近 0，说明它基本处于组内平均水平。TRL 文档中也说明，GRPO 会对同一个 prompt 生成 $G$ 个 completion，并用 reward 的均值和标准差来归一化 advantage。

这一步就是 GRPO 与 PPO 最大的区别。PPO 的 advantage 通常依赖 critic；GRPO 的 advantage 来自组内相对比较。2025 年一篇关于 GRPO 对齐目标的分析论文也将 GRPO 描述为：对同一上下文采样一组输出，观察奖励，并对奖励做 shift-and-scale normalization，同时加入 reference policy 惩罚来限制偏移。

## 3. GRPO 的目标函数

GRPO 仍然保留 PPO 的“不要更新太猛”的思想。对每个 token，定义重要性采样比率：

$$
\rho_{i,t}(\theta) =
\frac{
\pi_\theta(o_{i,t} \mid q, o_{i,<t})
}{
\pi_{\theta_{\text{old}}}(o_{i,t} \mid q, o_{i,<t})
}
$$

如果当前模型让某个 token 的概率比旧模型高很多，那么 $\rho$ 就会变大；如果低很多，则 $\rho$ 会变小。为了稳定训练，GRPO 使用 PPO 风格的 clip：

$$
\text{clip}(\rho_{i,t}, 1-\epsilon, 1+\epsilon)
$$

核心优化项可以写成：

$$
\min \left(
\rho_{i,t} A_i,
\text{clip}(\rho_{i,t}, 1-\epsilon, 1+\epsilon) A_i
\right)
$$

如果 $A_i > 0$，模型会倾向于提高这个回答中 token 的概率；如果 $A_i < 0$，模型会倾向于降低这些 token 的概率。clip 的作用是防止概率变化过大。

此外，GRPO 通常还会加入 KL 惩罚，用来约束当前策略不要偏离参考模型太远：

$$
D_{\mathrm{KL}}\left(\pi_\theta \,\|\, \pi_{\mathrm{ref}}\right)
$$

综合起来，一个常见的 GRPO 最大化目标可以写成：

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
r_{i,t}\hat A_{i,t},
\operatorname{clip}(r_{i,t}, 1-\epsilon, 1+\epsilon)\hat A_{i,t}
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

其中：

$$
r_{i,t}
=
\frac{
\pi_\theta(o_{i,t}\mid q, o_{i,<t})
}{
\pi_{\theta_{\mathrm{old}}}(o_{i,t}\mid q, o_{i,<t})
}

$$

这里，$\hat A_{i,t}$ 表示第 $i$ 个生成结果在第 $t$ 个 token 上的优势估计；$r_{i,t}$ 是当前策略相对于旧策略的概率比；$\epsilon$ 控制 PPO-style clipping 的范围；$\beta$ 控制 KL 惩罚强度。

直观上，reward 或 advantage 项负责把模型往“更好”的方向推，而 KL 项负责限制当前策略 $\pi_\theta$ 不要偏离参考模型 $\pi_{\mathrm{ref}}$ 太远。因此，在最大化目标中，KL 项前面是负号：

$$
-\beta D_{\mathrm{KL}}\left(\pi_\theta \,\|\, \pi_{\mathrm{ref}}\right)
$$

如果把它写成需要最小化的 loss，则符号会反过来：

$$
\mathcal{L}_{\mathrm{GRPO}}(\theta)
=
-
J_{\mathrm{GRPO}}(\theta)
$$

此时 KL 惩罚项在 loss 中表现为正项：

$$
+\beta D_{\mathrm{KL}}\left(\pi_\theta \,\|\, \pi_{\mathrm{ref}}\right)
$$
## 4. GRPO 为什么适合推理任务？

GRPO 特别适合数学、代码、逻辑推理这类任务，原因是这些任务通常可以设计 verifiable reward，也就是“可验证奖励”。比如：

* 数学题：最终答案是否正确；
* 代码题：是否通过单元测试；
* 格式题：是否满足 XML、JSON 或正则约束；
* 多步推理题：答案是否匹配标准答案。

这类 reward 不一定需要人工偏好标注，也不一定需要训练复杂的 reward model。模型只要能生成多个候选答案，就可以通过规则或验证器判断哪些更好。GRPO 正好利用了这种“同题多采样 + 组内比较”的结构。

## 5. 一个直观例子

假设问题是：

```text
计算 23 × 17 的结果。
```

模型采样 4 个回答：

```text
o1: 23 × 17 = 391
o2: 23 × 17 = 381
o3: 23 × 17 = 391
o4: 23 × 17 = 401
```

奖励函数设为：答案正确得 1，错误得 0。

$$
r = [1, 0, 1, 0]
$$

组内均值：

$$
\mu = 0.5
$$

标准差约为：

$$
\sigma = 0.5
$$

advantage 为：

$$
A = [1, -1, 1, -1]
$$

于是，GRPO 会提高 $o_1$、$o_3$ 这类正确回答的概率，降低 $o_2$、$o_4$ 这类错误回答的概率。注意，整个过程没有 critic。模型只是通过“同组内谁更好”来获得训练信号。

## 6. 用 Hugging Face TRL 快速实现 GRPO

现在最方便的实现方式是使用 Hugging Face TRL 的 `GRPOTrainer`。TRL 官方文档给出的 quick start 使用 `Qwen/Qwen2.5-0.5B-Instruct`、`DeepMath-103K` 数据集和 `accuracy_reward` 来训练 GRPO。

先安装依赖：

```bash
pip install -U transformers datasets accelerate trl
```

一个最小训练脚本如下：

```python
# train_grpo.py
from datasets import load_dataset
from trl import GRPOTrainer, GRPOConfig
from trl.rewards import accuracy_reward

dataset = load_dataset("trl-lib/DeepMath-103K", split="train")

training_args = GRPOConfig(
    output_dir="qwen-grpo-math",
    per_device_train_batch_size=1,
    gradient_accumulation_steps=8,
    num_generations=4,          # 每个 prompt 生成多少个候选回答，即 group size
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

运行：

```bash
accelerate launch train_grpo.py
```

这个版本适合理解流程，但真实训练仍然需要较好的 GPU 资源。如果只是学习算法，可以先用很小的模型、小数据集、较短的 `max_completion_length` 和较小的 `num_generations` 跑通流程。

## 7. 自定义 reward function

很多时候，我们不想只用现成的 `accuracy_reward`，而是希望自己写 reward。比如希望模型输出必须包含 `<answer>...</answer>`，同时答案正确才给高分：

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

然后把它传给 `GRPOTrainer`：

```python
trainer = GRPOTrainer(
    model="Qwen/Qwen2.5-0.5B-Instruct",
    reward_funcs=format_and_accuracy_reward,
    args=training_args,
    train_dataset=dataset,
)
```

这就是 GRPO 的工程魅力：你可以把复杂目标拆成 reward。比如“格式正确 + 答案正确 + 推理长度适中 + 不胡乱输出”，都可以通过 reward function 加权组合。

## 8. 用 PyTorch 理解 GRPO loss

下面是一个简化版 GRPO loss，仅用于理解，不是完整工业实现：

```python
import torch
import torch.nn.functional as F

def grpo_loss(
    logp,        # [B, G, T] 当前策略下每个 token 的 log prob
    old_logp,    # [B, G, T] 旧策略 log prob
    ref_logp,    # [B, G, T] 参考模型 log prob
    rewards,     # [B, G] 每个 completion 的 reward
    mask,        # [B, G, T] padding mask，真实 token 为 1
    clip_eps=0.2,
    beta=0.01,
    adv_eps=1e-6,
):
    # 1. 组内 advantage
    mean = rewards.mean(dim=1, keepdim=True)
    std = rewards.std(dim=1, keepdim=True)
    adv = (rewards - mean) / (std + adv_eps)  # [B, G]

    # 2. 扩展到 token 维度
    adv = adv.unsqueeze(-1)  # [B, G, 1]

    # 3. PPO-style ratio
    ratio = torch.exp(logp - old_logp)

    unclipped = ratio * adv
    clipped = torch.clamp(ratio, 1 - clip_eps, 1 + clip_eps) * adv
    policy_obj = torch.minimum(unclipped, clipped)

    # 4. 简化 KL：当前模型与 reference model 的 token-level 差异
    kl = logp - ref_logp

    # 5. 最大化 objective 等价于最小化负号
    token_loss = -(policy_obj - beta * kl)

    # 6. 只统计非 padding token
    loss = (token_loss * mask).sum() / mask.sum().clamp_min(1.0)

    return loss
```

这个函数展示了 GRPO 的关键结构：组内 reward 标准化、importance ratio、clip、KL penalty、token mask。真实实现还会处理生成、分布式训练、混合精度、reference model 推理、日志统计、reward 聚合、长度归一化等问题。

## 9. 常见坑

第一，group size 太小会导致 advantage 噪声很大。比如 $G=2$ 时，只要一个对一个错，信号很强；但如果两个都对或两个都错，组内方差可能很小，训练信号会变弱。

第二，二值 reward 容易稀疏。如果所有回答都是 0，标准化后可能没有有效梯度；如果所有回答都是 1，也无法区分谁更好。因此实际训练中常常需要格式奖励、过程奖励、长度奖励或更细粒度的 verifier。

第三，KL 系数需要调。KL 太大，模型学不动；KL 太小，模型可能快速偏离原模型，出现格式崩坏、重复输出或 reward hacking。

第四，reward design 比算法本身更重要。GRPO 只是优化器，reward 才定义了模型最终会成为什么样。奖励函数写得粗糙，模型就会钻空子。

## 10. 总结

GRPO 可以理解为“没有 critic 的 PPO”。它保留了 PPO 的稳定更新思想，但把 advantage 的估计方式从 value model 改成了 group-relative reward normalization。对同一个 prompt 采样多个回答，计算每个回答的 reward，再根据组内均值和标准差得到相对 advantage。这样既节省了训练 critic 的成本，也特别适合数学、代码、格式约束等可验证任务。

如果你是新手，建议学习路径如下：先理解 PPO 的 ratio 和 clip，再理解 advantage 的作用，然后把 critic-based advantage 替换成 group-relative advantage，最后用 TRL 的 `GRPOTrainer` 跑一个小模型实验。真正上手之后你会发现，GRPO 的难点不在公式，而在 reward function、数据分布、采样策略和训练稳定性。

一句话总结：GRPO 不是让模型知道“绝对正确答案是什么”，而是让模型在同一道题的多个候选答案中学会“哪个更值得模仿”。这正是它在推理型大模型后训练中如此有用的原因。
