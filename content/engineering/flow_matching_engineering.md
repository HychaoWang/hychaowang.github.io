+++
date = '2026-01-02T13:51:15+08:00'
draft = false
title = 'Flow Matching 工程实践：从零实现 OT-CFM'
tags = ["CS.AI", "CS.ML", "Deep Research"]
mathjax = true
+++

这是一个从零开始实现最基础 Flow Matching (Naive Flow Matching) 的方法，基于**Optimal Transport Conditional Flow Matching (OT-CFM)** 路径来实现。

**目标**：训练一个模型，将标准高斯噪声（源分布）变换为 2D “双月” 数据（目标分布）。

**核心思想回顾**：
不需要复杂的 SDE 推导，我们只需要做三件事：
1.  **采样**：取一个噪声点 $x_0$ 和一个数据点 $x_1$。
2.  **插值**：在它们之间画一条直线，随机选一个时间 $t$，计算中间位置 $x_t$。
3.  **回归**：训练神经网络在输入 $(t, x_t)$ 时，预测这条直线的方向（速度） $x_1 - x_0$。

---

### 0. 环境准备

你需要安装以下库：
```bash
pip install torch numpy matplotlib scikit-learn
```

第一步：准备数据 (Data Preparation)我们需要一个简单的 2D 数据集作为目标分布 $p_1$。这里使用 sklearn 的 make_moons。

```Python
import torch
import numpy as np
from sklearn.datasets import make_moons
import matplotlib.pyplot as plt
```

### 1. 数据集构建
```Python
def get_data(n_samples=10000):
    # 生成双月数据
    data, _ = make_moons(n_samples=n_samples, noise=0.05)
    # 归一化数据，使其大致分布在 [-2, 2] 之间，便于训练
    data = (data - data.mean(axis=0)) / data.std(axis=0)
    return torch.from_numpy(data).float()

# 可视化看一下目标分布
data = get_data()
plt.figure(figsize=(5, 5))
plt.scatter(data[:, 0], data[:, 1], s=1, alpha=0.5)
plt.title("Target Data Distribution (x1)")
plt.show()
```

{{< figure src="/img/assets/data_visualization.png" title="双月数据分布" width="300" >}}

### 第二步：搭建向量场网络 (The Vector Field Network)
这是 Flow Matching 的核心模型 $v_\theta(t, x)$。它接收时间 $t$ 和位置 $x$，输出速度向量。输入：时间 $t$ (维度 1) + 坐标 $x$ (维度 2) = 3。输出：速度 $v$ (维度 2)。技巧：为了让网络更好地感知时间 $t$，我们不仅将 $t$ 作为输入，还可以使用简单的 Embedding（或者直接拼接，对于简单 2D 任务直接拼接即可）。

```Python
import torch.nn as nn

class VectorFieldNetwork(nn.Module):
    def __init__(self, hidden_dim=64):
        super().__init__()
        # 简单的 MLP：输入 dim=3 (x, y, t)，输出 dim=2 (vx, vy)
        self.net = nn.Sequential(
            nn.Linear(3, hidden_dim),
            nn.Tanh(), # Tanh 或 Swish/SiLU 在流模型中通常比 ReLU 表现更好
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, 2)
        )

    def forward(self, t, x):
        # t 的形状通常是 [batch, 1]
        # x 的形状是 [batch, 2]
        # 将它们拼接起来 -> [batch, 3]
        inputs = torch.cat([x, t], dim=-1)
        return self.net(inputs)

# 实例化模型
model = VectorFieldNetwork()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
```

### 第三步：构建 Flow Matching 损失函数 (The Crucial Step)
这是工程实现中最关键的一步。根据文档中的 OT-CFM 公式：路径：$x_t = (1 - t)x_0 + t x_1$目标速度：$u_t(x|x_0, x_1) = x_1 - x_0$我们需要在代码中动态构建这个训练对。

```Python
def compute_loss(model, x1):
    """
    x1: 来自真实数据的样本 [batch_size, 2]
    """
    batch_size = x1.shape[0]
    
    # 1. 采样 x0: 从标准高斯噪声采样 [batch_size, 2]
    x0 = torch.randn_like(x1)
    
    # 2. 采样时间 t: 均匀分布 [0, 1] -> [batch_size, 1]
    t = torch.rand(batch_size, 1).to(x1.device)
    
    # 3. 计算中间状态 xt (线性插值)
    # 公式: xt = (1 - t) * x0 + t * x1
    # 这一步体现了 Optimal Transport 的直线路径假设
    xt = (1 - t) * x0 + t * x1
    
    # 4. 计算目标向量场 ut (Conditional Vector Field)
    # 对于直线路径，速度就是终点减起点
    ut = x1 - x0
    
    # 5. 模型预测 vt
    vt = model(t, xt)
    
    # 6. 计算损失: MSE(预测速度, 真实速度)
    loss = torch.mean((vt - ut) ** 2)
    
    return loss
```

### 第四步：训练循环 (Training Loop)
把上面的部分组合起来进行训练。

```Python
# 训练参数
n_steps = 10000
batch_size = 128
dataset = get_data(n_samples=50000) # 生成足够多的数据

losses = []

print("开始训练...")
for step in range(n_steps):
    # 随机抽取 batch
    indices = torch.randint(0, len(dataset), (batch_size,))
    x1_batch = dataset[indices]
    
    # 计算损失并更新
    optimizer.zero_grad()
    loss = compute_loss(model, x1_batch)
    loss.backward()
    optimizer.step()
    
    if step % 1000 == 0:
        print(f"Step {step}: Loss = {loss.item():.4f}")
        losses.append(loss.item())

print("训练完成！")
```

### 第五步：采样/推理 (Inference via ODE Solver)
训练好模型后，我们得到了一个向量场。要生成数据，我们需要从噪声 $x_0 \sim \mathcal{N}(0, I)$ 出发，沿着向量场积分到 $t=1$。这本质上是解一个 ODE（常微分方程）：$$dx = v_\theta(t, x) dt$$为了教学目的，我们手写一个最简单的 欧拉求解器 (Euler Solver)。

```Python
@torch.no_grad()
def sample_euler(model, n_samples=2000, n_steps=100):
    x = torch.randn(n_samples, 2) # 1. 初始化 x0 (噪声)
    dt = 1.0 / n_steps # 定义时间步长 dt
    traj = [x.clone()] # 存储轨迹用于后续可视化 (可选)
    
    # 2. ODE 积分循环 (从 t=0 到 t=1)
    for i in range(n_steps):
        # 当前时间 t (需要扩展为 [batch, 1] 形状)
        t = torch.ones(n_samples, 1) * (i * dt)
        # 模型预测当前位置的速度
        v_pred = model(t, x)
        # 欧拉更新: x_new = x_old + v * dt
        x = x + v_pred * dt
        traj.append(x.clone())
        
    return x, traj

# 执行采样
generated_data, trajectory = sample_euler(model)
```

### 第六步：结果可视化 (Visualization)
最后，我们将生成的样本与真实分布对比，并画出粒子移动的轨迹，以验证 Flow Matching 是否成功学习了“直线”路径。

```Python
# 转换数据为 numpy
traj_np = torch.stack(trajectory).numpy() # shape: [steps, samples, 2]
gen_np = generated_data.numpy()
target_np = dataset[:2000].numpy()

plt.figure(figsize=(12, 5))

# 图 1: 生成结果 vs 真实数据
plt.subplot(1, 2, 1)
plt.scatter(target_np[:, 0], target_np[:, 1], s=1, alpha=0.5, label='Real Data', c='gray')
plt.scatter(gen_np[:, 0], gen_np[:, 1], s=1, alpha=0.5, label='Generated (Flow)', c='red')
plt.legend()
plt.title("Generation Result")

# 图 2: 粒子轨迹 (Flow Trajectories)
# 只画前 50 个粒子的轨迹，避免太乱
plt.subplot(1, 2, 2)
for i in range(50):
    plt.plot(traj_np[:, i, 0], traj_np[:, i, 1], c='blue', alpha=0.3, linewidth=0.5)
plt.scatter(traj_np[0, :50, 0], traj_np[0, :50, 1], c='green', s=10, label='Start (Noise)')
plt.scatter(traj_np[-1, :50, 0], traj_np[-1, :50, 1], c='red', s=10, label='End (Data)')
plt.title("Particle Trajectories (Straight Lines?)")
plt.legend()

plt.tight_layout()
plt.show()
```

{{< figure src="/img/assets/flow_matching_results.png" title="运行结果" width="600" >}}


这个教程实现了一个最简单的 Flow Matching 系统。在 Flow Matching (OT-CFM) 中，我们训练模型去逼近直线路径 ($x_1 - x_0$)。理想情况下，推理阶段的粒子轨迹应当是非常直的。这与扩散模型不同，扩散模型的逆向生成过程轨迹通常是弯曲且充满噪声的。轨迹越直，意味着我们可以用更大的步长（更少的 n_steps）来求解 ODE，这就是 Flow Matching 生成速度快的原因。代码关键点：Loss 计算：没有复杂的积分，仅仅是简单的 MSE 回归。时间输入：必须把 $t$ 喂给网络，因为向量场是随时间变化的 (Time-dependent)。

Simulation-Free：训练过程中我们没有调用 ODE 求解器，只在最后生成时调用了一次。你可以尝试将 n_steps 在 sample_euler 中减少到 10 甚至 5，你会发现效果依然不错，这展示了 FM 的鲁棒性。