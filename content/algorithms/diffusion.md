+++
date = '2026-01-03T00:58:04+08:00'
draft = false
title = '从混沌到秩序：Diffusion Model 数学原理解析'
tags = ["CS.AI", "CS.ML"]
mathjax = true
+++

> **摘要**：在AIGC爆发的今天，Stable Diffusion、Midjourney 等模型重新定义了数字艺术的创作方式。但这背后的魔法究竟是什么？不同于 GAN 的“博弈”或 VAE 的“压缩”，Diffusion Model 选择了一条基于非平衡热力学的独特路径：**通过学习逆转熵增的过程来创造数据**。
>
> 本文将带你深入 Diffusion Model 的核心，从高斯分布的性质出发，一步步推导变分下界（ELBO），解构 DDPM、DDIM 以及 Latent Diffusion 的数学本质。无论你是算法工程师还是数学爱好者，这篇文章都将是你理解扩散模型的终极指南。

------

## 1. 引言：生成模型的第三种范式

在 Diffusion 统治世界之前，生成领域主要由两座大山把持：

- **GAN (生成对抗网络)**：不仅训练不稳定（模式坍塌），而且数学解释性较差，虽然效果惊艳但难以控制。
- **VAE (变分自编码器)**：数学优美，但生成的图像往往模糊，缺乏细节。

Diffusion Model (扩散模型) 的出现，打破了“高质量”与“多样性”不可兼得的魔咒。它受启发于非平衡热力学，定义了一个缓慢破坏数据结构的过程，并训练一个神经网络来逆转这个过程。

------

## 2. 直观理解：墨水、迷雾与米开朗基罗

在深入公式之前，我们需要建立物理直觉。

物理视角：想象一滴墨水滴入清水中。随着时间推移，墨水分子扩散，最终整杯水变成均匀的淡蓝色。这不仅是扩散（Diffusion），也是熵增的过程，信息逐渐丢失，最终变成了各向同性的高斯噪声。

生成视角：生成模型的任务是：如果我给你一杯混合均匀的淡蓝色墨水水杯，你能否让时间倒流，让墨水分子一步步退回到最初那滴墨水的形状？

这听起来是不可能的，因为从有序到无序是自然的，从无序到有序需要消耗能量（信息）。**Diffusion Model 的本质，就是训练一个神经网络，让它学会这个“逆天改命”的去噪步骤。**

正如米开朗基罗所说：“雕像就在石头里，我只是把多余的部分去掉了。” 扩散模型也是如此：图像就在噪声里，模型只是把多余的噪声去掉了。

------

## 3. 数学基石：前向扩散过程 (The Forward Process)

我们将数据分布记为 $x_0 \sim q(x_0)$。前向过程是一个**马尔可夫链（Markov Chain）**，我们在每一步向数据中添加微小的高斯噪声。

### 3.1 逐步加噪

设定一个固定的方差调度表（Variance Schedule） $\beta_1, \dots, \beta_T$，其中 $0 < \beta_1 < \dots < \beta_T < 1$。

在时刻 $t$，给定 $x_{t-1}$，生成 $x_t$ 的分布为：

$$q(x_t | x_{t-1}) = \mathcal{N}(x_t; \sqrt{1 - \beta_t} x_{t-1}, \beta_t \mathbf{I})$$

这里的 $\sqrt{1 - \beta_t}$ 因子是为了控制方差，使得当 $T \to \infty$ 时，$x_T$ 趋近于标准正态分布 $\mathcal{N}(0, \mathbf{I})$。

### 3.2 任意时刻 $t$ 的快速采样（Nice Property）

如果我们想得到 $x_{100}$，难道要一步步采样 100 次吗？不需要。由于高斯分布叠加后依然是高斯分布，我们可以直接从 $x_0$ 算出 $x_t$。

定义：

- $\alpha_t = 1 - \beta_t$
- $\bar{\alpha}_t = \prod_{i=1}^t \alpha_i$ (累乘)

通过重参数化技巧（Reparameterization Trick），令 $\epsilon \sim \mathcal{N}(0, \mathbf{I})$，我们可以推导：

$$\begin{aligned} x_t &= \sqrt{\alpha_t}x_{t-1} + \sqrt{1-\alpha_t}\epsilon_{t-1} \\ &= \sqrt{\alpha_t}(\sqrt{\alpha_{t-1}}x_{t-2} + \sqrt{1-\alpha_{t-1}}\epsilon_{t-2}) + \sqrt{1-\alpha_t}\epsilon_{t-1} \\ &= \dots \\ &= \sqrt{\bar{\alpha}_t}x_0 + \sqrt{1 - \bar{\alpha}_t}\epsilon \end{aligned}$$

结论：我们可以直接用 $x_0$ 和一个随机噪声 $\epsilon$ 采样出任意时刻的 $x_t$：



$$q(x_t | x_0) = \mathcal{N}(x_t; \sqrt{\bar{\alpha}_t} x_0, (1 - \bar{\alpha}_t)\mathbf{I})$$

这个公式是扩散模型训练效率的关键，它允许我们在训练时随机抽取任意时间步 $t$ 进行计算。

------

## 4. 逆向去噪过程 (The Reverse Process)

我们的目标是采样 $x_{new} \sim q(x_0)$。如果我们能知道逆向分布 $q(x_{t-1}|x_t)$，就可以从纯噪声 $x_T \sim \mathcal{N}(0, \mathbf{I})$ 开始，一步步采样回 $x_0$。

然而，$q(x_{t-1}|x_t)$ 依赖于整个数据集的分布，无法直接计算（Intractable）。

因此，我们需要训练一个神经网络 $p_\theta$ 来近似这个条件概率：

$$p_\theta(x_{t-1} | x_t) = \mathcal{N}(x_{t-1}; \mu_\theta(x_t, t), \Sigma_\theta(x_t, t))$$

这里有两个关键点：

1. **高斯假设**：Feller (1949) 的理论证明，当 $\beta_t$ 足够小时，逆向过程也可以近似为高斯分布。
2. **参数化**：我们需要神经网络学习的是均值 $\mu_\theta$ 和方差 $\Sigma_\theta$（DDPM 中方差通常固定为常数，后续改进才学习方差）。

------

## 5. 硬核推导：训练目标与变分下界 (ELBO)

这是整篇文章最“劝退”但也最精华的部分。我们如何训练 $p_\theta$？当然是最大化数据的对数似然 $\log p_\theta(x_0)$。

### 5.1 变分下界 (VLB)

直接优化 $\log p_\theta(x_0)$ 是困难的，我们借鉴 VAE 的思路，优化其**变分下界 (Variational Lower Bound, ELBO)**：

$$\mathbb{E}[-\log p_\theta(x_0)] \leq \mathbb{E}_q \left[ -\log \frac{p_\theta(x_{0:T})}{q(x_{1:T}|x_0)} \right] = L_{VLB}$$

经过一系列复杂的数学展开（利用马尔可夫性质和贝叶斯公式），$L_{VLB}$ 可以被改写为三项之和：

$$L_{VLB} = L_T + L_{T-1} + \dots + L_0$$

$$L_{VLB} = \underbrace{D_{KL}(q(x_T|x_0) || p(x_T))}_{L_T: 常数项} + \sum_{t=2}^T \underbrace{D_{KL}(q(x_{t-1}|x_t, x_0) || p_\theta(x_{t-1}|x_t))}_{L_{t-1}: 去噪匹配项} - \underbrace{\log p_\theta(x_0|x_1)}_{L_0: 重构项}$$

- **$L_T$**：前向过程终点分布与标准高斯的差异。由于前向过程是固定的，这一项没有可训练参数，忽略。
- **$L_{t-1}$**：核心项。它度量了“真实逆向后验”（在已知 $x_0$ 的情况下）与“模型预测逆向分布”之间的 KL 散度。
- **$L_0$**：最后一步解码的重构误差。

### 5.2 破解核心：$q(x_{t-1}|x_t, x_0)$

你可能会问：刚才不是说逆向分布 $q(x_{t-1}|x_t)$ 未知吗？

是的，但是，如果我们已知 $x_0$（训练时我们当然知道原图），那么 $q(x_{t-1}|x_t, x_0)$ 是完全可以计算的！

通过贝叶斯公式凑项，可以算出 $q(x_{t-1}|x_t, x_0)$ 也是一个高斯分布，其均值 $\tilde{\mu}_t(x_t, x_0)$ 为：

$$\tilde{\mu}_t(x_t, x_0) = \frac{1}{\sqrt{\alpha_t}} \left( x_t - \frac{1-\alpha_t}{\sqrt{1-\bar{\alpha}_t}} \epsilon \right)$$

这告诉我们：**如果我们想让模型 $p_\theta(x_{t-1}|x_t)$ 逼近真实后验，本质上就是让模型的均值 $\mu_\theta$ 去逼近上面的 $\tilde{\mu}_t$。**

### 5.3 终极简化：DDPM 的 Loss

DDPM (Ho et al., 2020) 发现，不要直接预测 $x_{t-1}$ 或均值 $\tilde{\mu}$，而是让网络**预测噪声** $\epsilon$，效果最好。

将上述公式代入 KL 散度，并丢掉复杂的加权系数，我们得到惊人简洁的损失函数：

$$L_{simple}(\theta) = \mathbb{E}_{t, x_0, \epsilon} \left[ \| \epsilon - \epsilon_\theta(\underbrace{\sqrt{\bar{\alpha}_t}x_0 + \sqrt{1-\bar{\alpha}_t}\epsilon}_{x_t}, t) \|^2 \right]$$

人话解释：

训练过程极其简单：

1. 随机取一张图 $x_0$。
2. 随机取一个时间步 $t$。
3. 生成一个随机噪声 $\epsilon$。
4. 把噪声按强度加到图上得到 $x_t$。
5. **让神经网络看这张噪点图 $x_t$ 和时间 $t$，让它猜刚才加的噪声 $\epsilon$ 是什么。**
6. 计算猜的噪声和真实噪声的 MSE Loss。

这就是 Diffusion Model 数学大厦的顶石。

------

## 6. 连接现实：网络架构与细节

### 6.1 U-Net 架构

模型 $\epsilon_\theta(x_t, t)$ 通常使用 U-Net 架构。为何？

- **多尺度特征**：生成图像既需要理解全局结构（轮廓），也需要理解局部细节（纹理）。U-Net 的下采样和上采样路径完美契合。
- **输入输出同构**：输入是带噪图像，输出是噪声图，尺寸一致。

### 6.2 时间步注入 (Time Embedding)

网络必须知道当前的“噪声水平”是多大（是 $t=5$ 的轻微噪声，还是 $t=900$ 的纯噪声）。

通过类似于 Transformer 的 Positional Embedding，将标量 $t$ 映射为向量，加到 U-Net 的每一层特征中。

------

## 7. 进阶之路：采样加速与潜在空间

DDPM 虽然效果好，但采样太慢（需要几百上千步）。后续研究主要解决这个问题。

### 7.1 DDIM (Denoising Diffusion Implicit Models)

DDPM 假设逆向过程也是马尔可夫的。DDIM 指出，只要边缘分布 $q(x_t|x_0)$ 保持不变，我们可以构造一个非马尔可夫的前向过程。

这意味着我们可以推导出确定的（Deterministic）逆向映射。

结果：DDIM 允许我们“跳步”采样。比如从 $t=1000$ 直接预测 $t=900$，把 1000 步压缩到 50 步，大大提升了生成速度。

### 7.2 Latent Diffusion Models (LDM / Stable Diffusion)

直接在像素空间（Pixel Space）做扩散非常昂贵。一张 512x512 的图有 78万个维度。

LDM 的策略：

1. **感知压缩**：先训练一个 VAE，把图像压缩到低维潜空间（Latent Space，例如 64x64）。
2. **潜空间扩散**：在 Latent Space 上训练 Diffusion Model。
3. **解码**：生成完潜变量后，用 VAE Decoder 还原回像素。

这不仅极大降低了显存需求，还让普通显卡运行 Stable Diffusion 成为可能。

### 7.3 Classifier-Free Guidance (CFG)

如何让模型听懂 "A painting of a cat in Van Gogh style"？

我们需要引入条件 $c$ (文字 embedding)。

CFG 提出了一种巧妙的技巧来增强控制力：同时训练两个模型（或者同一个模型通过 mask 实现），一个带条件 $\epsilon_\theta(x_t, t, c)$，一个不带条件 $\epsilon_\theta(x_t, t)$。

最终预测的噪声是两者的线性组合：



$$\tilde{\epsilon} = \epsilon_\theta(x_t, t) + w \cdot (\epsilon_\theta(x_t, t, c) - \epsilon_\theta(x_t, t))$$



其中 $w$ 是 Guidance Scale。$w$ 越大，生成的图越符合提示词，但可能牺牲图像自然度。

------

## 8. 结语

从 2015 年的一篇冷门物理学启发的论文，到 2025 年改变创意产业的基石，Diffusion Model 的发展史是数学直觉与工程实践结合的完美典范。

它告诉我们：**破坏往往比建设容易，但如果我们能完美地理解破坏的过程，我们就能掌握建设的艺术。** 通过学习如何去除噪声，我们教会了机器如何从虚无中描绘出无限的世界。