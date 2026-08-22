---
title: "GPU Architecture and Optimization for Large Language Models"
description: "An overview of GPU architecture and practical optimization techniques for training and serving large language models."
date: "2026-08-22"
draft: false
---

GPUs are the fundamental hardware for training modern models. Training and serving LLMs are expensive and slow tasks, so understanding the underlying architecture and optimization methods is essential.

## GPU Architecture

Unlike CPUs, GPU architectures are designed for massive parallel computation. In a CPU, several ALUs share a large control unit and cache. This design lets the CPU handle complex tasks and reduce latency. GPUs are designed for high-throughput workloads. A GPU has a large number of compute units, and each group of compute units shares one control unit and cache. A single GPU contains multiple control units and caches. Because the control units are simpler than those of a CPU and support branching more weakly, GPUs are not good at handling complex tasks.

The basic unit of a GPU is the SM (Streaming Multiprocessor). SMs process jobs independently in units of blocks. Each SM contains multiple SPs (Streaming Processors), which process multiple threads in parallel. GPUs have a four-level memory hierarchy. Ordered by speed: Shared Memory > L1 Cache > L2 Cache > Global Memory. Shared memory and L1/L2 caches are SRAM, while Global Memory is DRAM.

The GPU execution model consists of three parts: Threads, Blocks, and Warps.

- Threads execute in parallel, following the SIMT architecture (Single Instruction, Multiple Threads), where the same instruction processes different data in parallel.
- Blocks are groups of threads. Each block runs on one SM and uses its own shared memory.
- Warps execute groups of 32 consecutive threads.

Compared with GPUs, TPUs have lighter-weight control units, larger and faster matrix multiplication units (some do not accept matrix inputs smaller than 64), and faster memory.

Starting from the Nvidia V series, Tensor Cores, dedicated circuits for matrix multiplication, appeared, achieving more than 10x speedup over traditional GPU-based implementations.

## Optimization Methods Based on GPU Architecture

As GPUs have advanced, the compute speed of their compute units has grown rapidly, but memory speed has developed relatively slowly, creating a memory IO bottleneck. Avoiding memory speed limits is a key problem in LLM architecture optimization. The optimization methods mainly fall into the following six categories.

### Branch Control

As mentioned above, because of simplified control units, GPUs are not good at handling multi-branch tasks. Moreover, when branches are used, some threads execute the taken branch while others execute the not-taken branch; during parallel execution, the compute resources of the non-executing branch are wasted. Handling these branches may require additional computation passes, causing extra memory read pressure.

Therefore, avoid if-else style branching as much as possible.

### Low-Precision Computation

Models generally default to FP32 precision, but in practice not all computations need such high precision. Lowering precision at appropriate times can not only speed up computation but also reduce the amount of data read from memory.

For operations such as ReLU, tanh, add, sub, mul, and matrix multiplication, the lower-precision FP16/BF16 can be used. For computations that accumulate small values into large ones, more precision is needed; for example, reduction operations such as sum, softmax, and normalization are best done with FP32/FP16. Some operations need a larger range; for example, exp, log, pow, and loss functions should use FP32/BF16, giving more resources to the exponent bits of the floating-point number.

There are also more aggressive low-precision schemes, such as FP8 E4M3 and FP8 E5M2. The most advanced of these is MXFP8, which uses E4M3 as the base values plus E8M0 scaling factors to expand the range. Each group of values can freely choose different scaling factors, preventing a single scaling factor from limiting the range requirements of different regions, but this introduces a transpose problem.

### Operator Fusion

Fusing multiple operations into one reduces the number of memory reads. This can usually be done automatically with tools such as torch.compile.

### Recomputation

Recomputation mainly targets training. The naive approach saves the intermediate activations of the model during the forward pass, but they are not needed for a while and occupy storage. Recomputation does not save these intermediate activations during the forward pass; instead, it recomputes them when they are needed during backpropagation. Although this adds one forward computation, because memory bound is the main problem, the benefit of higher storage utilization is greater, and the overall system is accelerated.

### Coalesced Memory Access

Every DRAM read first activates an entire row, sending that row's data to the sense amplifier / row buffer. This process creates redundant reads. If every row read is exactly the data we need, then one read achieves the effect of multiple reads. Therefore, if threads within a warp read memory stored in the same batch, memory accesses can be coalesced, achieving speedup.

### Tiling

In the naive approach, for each data pixel, the corresponding pixel data is loaded first, computation is performed, and then the next pixel is read. In matrix multiplication, for N*N data, each pixel has to be read N times. These reads come from Global Memory, which is relatively slow.

Tiling divides data into blocks. Every time Global Memory is read, a corresponding T*T block is loaded into shared memory. The multiple Global Memory reads per pixel are turned into multiple shared memory reads, reducing the time cost of memory access. Note that choosing the tile size requires considering coalesced memory access, the size of shared memory, and the divisibility of the matrix dimensions.
