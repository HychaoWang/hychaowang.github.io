# Notes about Video Long Memory

给定一个长视频流和一个后续查询，模型不能把所有视觉内容一次性放进上下文，而必须在有限计算、有限显存、有限 token budget 下，持续地选择、压缩、保存、更新、检索视频历史信息，并利用这些记忆回答跨时间问题。

更形式化一点：
```
输入：长视频 $V = {x1, x2, ..., xT}$，其中 T 很大
查询：$q$
记忆：$M_t = Memory(x1, ..., xt)$
目标：基于 $q$ 从 $M_T$ 中检索/读取相关证据，生成答案 a
```
其中关键不只是回答：

$$a = VLM(sampled frames, q)$$

而是要研究：

$$M_t = Update(M_{t-1}, x_t)$$
$$evidence = Retrieve(M_T, q)$$
$$a = Reason(evidence, q)$$

所以 long video memory 的核心对象不是“视频很长”本身，而是 视频历史如何被写入、保存、遗忘、检索和推理使用。

可以。这里的“做掉”我理解为：已经有论文提出了可运行架构、做了实验或发布了模型/代码，而不是说问题已经彻底解决。**长视频 long memory** 目前还没有被完全解决；更多是不同子问题被分阶段做掉了。

# 现有的工作

## 1. 稀疏/双层 visual memory

最早一批明确把“长期记忆”放进长视频理解的是 [**MovieChat**][1]。它受 Atkinson-Shiffrin 记忆模型启发，把视频 token 组织成短期记忆和长期记忆：短期记忆快速更新，长期记忆稀疏保存压缩后的历史信息，用来处理长视频 QA。它还提出了 MovieChat-1K benchmark。后续 [**MovieChat+**][2]  做了 question-aware sparse memory，也就是记忆压缩不再完全问题无关，而是用 vision-question matching 来做更紧凑、更相关的 memory consolidation。

这一类方案主要是“视频内部记忆”，不是跨视频、跨会话的 lifelong memory；而且压缩后会牺牲细粒度空间信息和罕见事件。

## 2. Memory Bank 

[**MA-LMM**][3] 是很典型的 memory-bank 路线。它不是把所有帧一次性塞进 LLM，而是在线处理视频，把过去的视频信息存到 memory bank，使模型能引用历史视觉内容，同时避免超过 LLM 上下文窗口和 GPU 显存限制。这一路线的核心思路是：视觉编码器连续看视频，memory bank 保存过去的压缩视觉状态，LLM 在回答时访问这些状态。它已经部分解决了“如何在不爆上下文的情况下保留历史视觉信息”这个问题，但还没有真正解决“记忆何时写入、何时遗忘、如何纠错、如何处理冲突”的完整记忆生命周期。

## 3. Streaming/Recurrent Memory

长视频如果是流式输入，模型不能等视频全部结束再回答。因此出现了 streaming video memory。

[**VideoStreaming**][4] 提出 **Memory-Propagated Streaming Encoding** 和 **Adaptive Memory Selection**：视频被切成短片段，每个片段继承前一段的 memory；最后根据问题选择固定数量的相关历史 memory 输入 LLM。

[**VideoLLaMB**][5] 用 recurrent memory tokens 和 memory bridge layers，在长视频片段之间传递语义连续性，并配合 SceneTilling 分割语义单元。论文报告它在单 A100 上支持远超训练帧数的视频输入，并保持线性显存扩展。

[**Flash-VStream**][6] 进一步强调在线长视频流，提出 Flash Memory：低容量 context memory 聚合长程时序信息，高容量 augmentation/detail memory 用于检索关键帧细节。

这类方案已经做掉了“边看边记”“恒定 token 数或近似恒定 token 数处理长流”的工程雏形。但它们仍通常局限在单个视频流内，距离真实 24/7 视觉记忆、长期交互式环境记忆还有差距。

## 4. 层次化事件记忆 / memory tree

长视频不是均匀 token 序列，而是事件、场景、动作、人物状态的层次结构。因此不少论文把 memory 做成 event hierarchy。

[**HEM-LLM**][7] 提出 Hierarchical Event-based Memory-enhanced LLM，先自适应切分长视频事件，再构建层次化事件记忆来提升长视频理解。

[**StreamChat**][8] 用 hierarchical memory system 压缩长序列视频特征，并支持 streaming video reasoning 和多轮对话。论文还设计了长期记忆搜索、短期记忆搜索等任务来评估记忆保持。

[**OASIS**][9] 把 streaming video reasoning 重新定义为 temporal routing：关键不是“记得越多越好”，而是从巨大历史中找到正确证据。它组织 hierarchical event memory，并在模型不确定时按需检索。

[**VideoScaffold**][10] 也是类似方向：为 streaming video 构建 elastic-scale visual hierarchies，根据视频长度动态调整事件粒度，同时保留细粒度视觉语义。

这一类已经做掉了“事件级别长期记忆”的雏形，比简单帧采样更接近人类记忆。但还没有完全解决事件边界错误、层次摘要失真、多事件因果关系、跨场景实体一致性等问题。

## 5. agentic memory / 工具增强记忆

另一条路线不是让 VLM 一次性看完视频，而是让 LLM 作为 agent，反复规划、检索、调用工具、更新记忆。

有两个容易混淆的 VideoAgent。一个是 [**VideoAgent**][11]，核心是让 LLM 迭代识别关键信息，用视觉语言模型工具翻译和检索视觉内容，在 EgoSchema 和 NExT-QA 上用很少帧获得较好效果。

另一个是 [**VideoAgent**][12]，它构建 structured memory，同时存 generic temporal event descriptions 和 object-centric tracking states，并通过视频片段定位、对象记忆查询等工具解决长视频任务。

更新的 [**VideoARM**][13] 把 agentic reasoning 和 hierarchical memory 合在一起，让 controller 在 observe-think-act-memorize 循环中动态构建多层次记忆。

[**EventMemAgent**][14] 进一步把 online video 理解做成主动 agent：短期记忆检测事件边界，长期记忆按事件归档历史观察，并用多粒度感知工具和 Agentic RL 学习推理与工具调用策略。

这类方案已经做掉了“被动压缩”到“主动检索/主动看哪里”的转变，但还没有证明在开放世界视频、复杂工具链和长期运行条件下足够稳健。

## 6. RAG / text memory / caption memory

有些方法把视频先变成 dense captions、事件描述、字幕、对象轨迹，再让 LLM 基于文本记忆推理。[**LLoVi**][15] 是代表：先用短视频 captioner 对密集采样片段生成文本描述，再由 LLM 聚合这些短期 caption 来回答长距离视频问题。

[**MemVid**][16] 则把 RAG 显式做成 memory-enhanced retrieval augmentation：先记忆整体视频信息，再基于任务推理信息需求，检索关键时刻，最后聚焦相关片段回答。

这一路线非常工程友好，因为文本 memory 可解释、可索引、可审计；但问题是视频细节会在 caption 阶段丢失，尤其是空间关系、细微动作、短暂物体、身份追踪和非语言声音线索。

## 7. 长上下文直接吃视频 + token 压缩

这类方法不一定叫 memory，但本质上是在扩展“可保留的视频历史”。

[**LongVA**][17] 提出 long context transfer：把语言模型的长上下文能力迁移到视觉输入，报告可以处理 2000 帧或超过 200K visual tokens，并提出 V-NIAH 来测视觉 needle-in-a-haystack。

[**Video-XL**][18] 用 Visual Summarization Token / Visual Context Latent Summarization 压缩视频片段的视觉上下文，目标是 hour-scale video understanding。

[**Hour-LLaVA**][19] 基于 VideoMarathon 数据集做 hour-long video training，并使用 memory augmentation module 从 cached full video context 中整合 question-relevant 和 spatiotemporal-informative semantics。

这类已经做掉了“更长上下文/小时级视频训练”的一部分，但它和真正的长期记忆仍有区别：长上下文是“当前输入更长”，不等于模型有可编辑、可更新、可遗忘的 persistent memory。

## 8. 时间地址化 memory / timestamp-aware memory

长视频 memory 不能只记“发生了什么”，还要记“什么时候发生”。因此很多工作专门做时间编码。

[**TimeChat**][20] 引入 timestamp-aware frame encoder 和 sliding video Q-Former，把视觉内容和时间戳绑定，并用 TimeIT 指令数据训练。

[**LITA**][21] 关注 Video LLM 的 temporal localization，加入 time tokens 和 SlowFast tokens，并提出 Reasoning Temporal Localization 任务。

[**VTG-LLM**][22] 把 timestamp knowledge 集成到 Video LLM，用 sequence-time embedding 和 absolute-time tokens 改善 video temporal grounding。

这类做掉了“时间索引/时间定位”的基础组件，但还没有解决更难的“长期状态变化记忆”：比如某物体从 A 处移动到 B 处、人物换装、工具被使用后状态改变、多个事件之间存在因果链。

## 9. question-guided / adaptive memory update

最近工作开始从“统一压缩视频”走向“根据问题动态决定记什么”。

[**ReWind**][23] 提出 read-perceive-write cycle：用 dynamic learnable memory module 随视频推进存储和更新 instruction-relevant visual information，然后用 memory-guided adaptive frame selection 选出高分辨率关键帧。

[**QViC-MF**][24] 用 question-guided visual compression 和 memory feedback，试图缓解传统 memory 模块因为容量有限或更新不当而漏掉问题相关信息的问题。

[**VideoMem**][25] 把超长视频理解建模成 sequential generation with adaptive memory management，用 global memory buffer 动态保留关键信息、丢弃冗余内容，并引入 PRPO 训练。

[**FlexMem**][26] 是 training-free 的 flexible visual memory 方法，模拟人类连续观看并回忆相关片段的过程。

这一类是目前最接近“智能记忆策略”的方向，但还处在快速发展阶段，远没到统一范式。

---

# 尚未真正实现/仍明显开放的方案

第一，**跨视频、跨会话、跨天的 persistent video memory** 还没有成熟。现有方法大多在“一个长视频”或“一个视频流”内部做 memory；还不是一个能长期生活在用户环境中的视觉记忆系统。真正的系统应该能记住多个视频、多次交互、不同日期的环境变化，并支持用户查看、编辑、删除和审计记忆。现有 [**LongVideoBench**][27]、StreamingBench 等 benchmark 主要还是长视频 QA 或流式视频 QA，而不是长期个人/环境记忆。LongVideoBench 也指出长视频理解的核心挑战是从长输入中检索并推理细节信息，先进闭源模型和开源模型都仍有明显挑战。

第二，**真正可靠的在线 memory** 还没完全实现。[**StreamingBench**][28] 评估 13 个开源和闭源 MLLM 后发现，即使 Gemini 1.5 Pro 和 GPT-4o 等先进模型，在流式视频理解上仍明显低于人类水平；OVO-Bench 对 11 个 Video-LLM 的评估也显示，当前模型在真实在线视频理解上仍有显著差距。

第三，**多模态统一记忆** 还没真正做好。现在很多方法主要记 visual tokens、keyframes、captions 或 event summaries，但真实长视频 memory 应该同时记视觉、语音、字幕、环境声音、人物身份、对象轨迹、空间布局和事件因果。现有 [**ProVideLLM**][29] 已经尝试把 verbalized text tokens 和 visual tokens 放进 multimodal cache，用长程文本摘要加短期细粒度视觉 token 支持实时 procedural video understanding，但这还不是完整的全模态世界状态记忆。

第四，**可纠错、可遗忘、可更新的 video memory** 还没有标准方案。很多论文会做 memory compression、selection、retrieval，但较少系统处理错误记忆、冲突记忆、过时记忆、来源追踪、版本控制和显式遗忘。[**OASIS**][9] 已经指出 streaming video reasoning 的关键不是扩大记忆容量，而是在巨大历史中找对证据；这说明“记得多”本身不是答案。

第五，**细粒度状态变化记忆** 还没解决。比如“杯子之前在桌上，后来被 A 拿走，又被 B 放进柜子”，这种需要对象持久性、身份绑定、动作因果和时间顺序。[**TimeChat**][20]、[**LITA**][21]、[**VTG-LLM**][22] 解决的是时间戳和 temporal localization 的一部分，但它们并不等价于完整的 object-state memory 或 causal event memory。

第六，**主动感知与主动记忆写入** 还只是初步做掉。[**VideoAgent**][12]、[**VideoARM**][13]、[**EventMemAgent**][14] 已经把 agentic reasoning、工具调用和 memory construction 结合起来，但更强的系统应该能主动决定：什么时候看高分辨率、什么时候追踪对象、什么时候调用 OCR/ASR/detector、什么时候回放历史片段、什么时候压缩或删除 memory。现有工作有雏形，但在开放世界、长时间运行、多任务切换下还没有成熟标准。

第七，**可证明的 memory policy / 记忆选择理论** 还缺。当前方法大多是启发式、模块式或经验训练：top-k retrieval、question-aware matching、hierarchical event search、RL-based buffer update 等。[**VideoMem**][25]、[**MemVid**][16]、[**QViC-MF**][24] 已经开始做 adaptive/question-guided memory，但还没有统一理论来回答：在固定 token/显存/延迟预算下，什么信息应该被保留，什么信息可以安全遗忘。

第八，**长视频 memory 的评测还不充分**。现在已有 MovieChat-1K、LongVideoBench、StreamingBench、OVO-Bench、VStream-QA 等，但大多数仍偏 QA accuracy、temporal grounding 或 streaming response。更贴近 memory 的评测应该覆盖：延迟很久后的 recall、反事实干扰、身份混淆、对象状态更新、错误记忆纠正、多轮对话中的记忆一致性、跨视频记忆迁移、隐私删除后的不可恢复性。[**StreamingBench**][30] 明确强调当前 MLLM 距离人类级 streaming video understanding 仍有差距，这也侧面说明评测与能力都还没到位。

---

一句话总结：**已经做掉的是“单视频/单流内的压缩记忆、层次事件记忆、流式 recurrent memory、question-aware memory、agentic retrieval memory”；尚未真正做掉的是“跨视频跨会话的 persistent video memory、可纠错可遗忘的记忆生命周期、全模态世界状态记忆、长期在线主动感知与理论化 memory policy”。**

[1]: https://arxiv.org/abs/2307.16449?utm_source=chatgpt.com "MovieChat: From Dense Token to Sparse Memory for Long Video Understanding"
[2]: https://arxiv.org/abs/2404.17176?utm_source=chatgpt.com "MovieChat+: Question-aware Sparse Memory for Long Video Question Answering"
[3]: https://arxiv.org/html/2404.05726v2?utm_source=chatgpt.com "MA-LMM: Memory-Augmented Large Multimodal Model for ..."
[4]: https://arxiv.org/abs/2405.16009?utm_source=chatgpt.com "Streaming Long Video Understanding with Large Language Models"
[5]: https://arxiv.org/abs/2409.01071?utm_source=chatgpt.com "VideoLLaMB: Long-context Video Understanding with Recurrent Memory Bridges"
[6]: https://arxiv.org/abs/2406.08085?utm_source=chatgpt.com "Flash-VStream: Memory-Based Real-Time Understanding for Long Video Streams"
[7]: https://arxiv.org/abs/2409.06299?utm_source=chatgpt.com "Enhancing Long Video Understanding via Hierarchical ..."
[8]: https://arxiv.org/abs/2501.13468?utm_source=chatgpt.com "Streaming Video Understanding and Multi-round Interaction with Memory-enhanced Knowledge"
[9]: https://arxiv.org/abs/2604.17052?utm_source=chatgpt.com "OASIS: On-Demand Hierarchical Event Memory for Streaming Video Reasoning"
[10]: https://arxiv.org/abs/2512.22226?utm_source=chatgpt.com "VideoScaffold: Elastic-Scale Visual Hierarchies for ..."
[11]: https://arxiv.org/abs/2403.10517?utm_source=chatgpt.com "VideoAgent: Long-form Video Understanding with Large Language Model as Agent"
[12]: https://arxiv.org/abs/2403.11481?utm_source=chatgpt.com "VideoAgent: A Memory-augmented Multimodal Agent for Video Understanding"
[13]: https://arxiv.org/abs/2512.12360?utm_source=chatgpt.com "VideoARM: Agentic Reasoning over Hierarchical Memory for Long-Form Video Understanding"
[14]: https://arxiv.org/abs/2602.15329?utm_source=chatgpt.com "EventMemAgent: Hierarchical Event-Centric Memory for Online Video Understanding with Adaptive Tool Use"
[15]: https://aclanthology.org/2024.emnlp-main.1209/?utm_source=chatgpt.com "A Simple LLM Framework for Long-Range Video Question- ..."
[16]: https://arxiv.org/abs/2503.09149?utm_source=chatgpt.com "Memory-enhanced Retrieval Augmentation for Long Video Understanding"
[17]: https://arxiv.org/html/2406.16852v2?utm_source=chatgpt.com "Long Context Transfer from Language to Vision"
[18]: https://arxiv.org/abs/2409.14485?utm_source=chatgpt.com "Video-XL: Extra-Long Vision Language Model for Hour-Scale Video Understanding"
[19]: https://arxiv.org/abs/2506.05332?utm_source=chatgpt.com "Unleashing Hour-Scale Video Training for Long Video-Language Understanding"
[20]: https://arxiv.org/abs/2312.02051?utm_source=chatgpt.com "TimeChat: A Time-sensitive Multimodal Large Language Model for Long Video Understanding"
[21]: https://arxiv.org/abs/2403.19046?utm_source=chatgpt.com "LITA: Language Instructed Temporal-Localization Assistant"
[22]: https://ojs.aaai.org/index.php/AAAI/article/download/32341/34496?utm_source=chatgpt.com "VTG-LLM: Integrating Timestamp Knowledge into Video ..."
[23]: https://arxiv.org/abs/2411.15556?utm_source=chatgpt.com "ReWind: Understanding Long Videos with Instructed Learnable Memory"
[24]: https://arxiv.org/abs/2603.15167?utm_source=chatgpt.com "Question-guided Visual Compression with Memory ..."
[25]: https://arxiv.org/abs/2512.04540?utm_source=chatgpt.com "VideoMem: Enhancing Ultra-Long Video Understanding via Adaptive Memory Management"
[26]: https://arxiv.org/abs/2603.29252?utm_source=chatgpt.com "Scaling the Long Video Understanding of Multimodal ..."
[27]: https://arxiv.org/abs/2407.15754?utm_source=chatgpt.com "LongVideoBench: A Benchmark for Long-context Interleaved Video-Language Understanding"
[28]: https://arxiv.org/abs/2411.03628?utm_source=chatgpt.com "StreamingBench: Assessing the Gap for MLLMs to Achieve Streaming Video Understanding"
[29]: https://arxiv.org/abs/2504.13915?utm_source=chatgpt.com "Memory-efficient Streaming VideoLLMs for Real-time Procedural Video Understanding"
[30]: https://streamingbench.github.io/?utm_source=chatgpt.com "StreamingBench"
