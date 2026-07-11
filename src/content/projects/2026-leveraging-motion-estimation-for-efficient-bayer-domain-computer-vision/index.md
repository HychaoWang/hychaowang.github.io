---
title: "Leveraging Motion Estimation for Efficient Bayer-Domain Computer Vision"
description: "IEEE International Conference on Image Processing (ICIP), 2026"
date: "2026-01-01"
paperURL: "https://2026.ieeeicip.org/"
draft: false
---

**Venue:** IEEE International Conference on Image Processing (ICIP)

**Authors:** **Haichao Wang**, Jiangtao Wen, Yuxing Han

Existing computer vision pipelines suffer from two efficiency bottlenecks: image signal processors (ISPs) first convert Bayer pixel data to RGB pixel by pixel, and video models repeatedly process temporally redundant frames, leading to high power consumption and latency. In this paper, we propose a novel framework that eliminates the ISP and leverages motion estimation to accelerate video vision tasks directly in the Bayer domain. We introduce Motion Estimation-based Video Convolution (MEVC), which integrates sliding-window motion estimation into each convolutional layer, enabling prediction and residual-based refinement that reduces redundant computations across frames. This design bridges the structural gap between block-based motion estimation and spatial convolution, enabling accurate, low-cost processing. Our end-to-end pipeline supports raw Bayer input and achieves over 70% reduction in FLOPs with minimal accuracy degradation across video semantic segmentation, depth estimation, and object detection benchmarks.

**Tags:** Motion Estimation, Bayer Domain, Efficient Vision
