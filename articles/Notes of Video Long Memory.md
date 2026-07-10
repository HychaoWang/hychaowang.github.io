# Notes of Video Long Memory

## Basic of Memory
### 记忆内容
1. Semantic 事实记忆。记事实，例如“某项目使用 PostgreSQL”。这类记忆适合存成 key-value、文档片段、实体关系或知识图谱。
2. Episodic 经历记忆。比如一次任务的输入、采取的步骤、工具调用、失败原因、最后结果。Generative Agents 的经典架构就是把 agent 的观察记录下来，再通过 reflection 和 retrieval 支持后续 planning。
3. Procedural 过程记忆。比如“写论文综述时先列 taxonomy，再按方法比较”“用户偏好代码回答带 type hints”“遇到部署失败先查 logs 再查 env”。LangChain / LangGraph 的 memory 文档也采用 semantic、episodic、procedural 这类划分。 
4. Preference 偏好记忆。记用户偏好、长期目标、身份背景、写作风格、常用工具。ChatGPT 的 Memory 就属于这一类工程产品：它区分 saved memories 和 reference chat history，用于在未来对话中个性化回答。

### 存储位置
1. 参数记忆。表现为模型权重，通过预训练、微调、LoRA、continual learning学习，特点是稳定、推理快，但更新成本高，难删除，易遗忘。
2. 上下文记忆。存在于当前 prompt / context window，包括聊天历史、system prompt、scratchpad、summary buffer，特点是最直接，但受窗口长度和 token 成本限制。
3. 推理态 State / KV Memory。存在于KV cache、recurrent state、SSM state，包括Transformer-XL、长上下文注意力、Mamba 类架构，主要解决长序列推理效率，不等同于可控长期记忆。
4. 外部检索 Retrieval Memory。存在于向量库、搜索索引、文档库。包括RAG、hybrid search、reranker。工程上最常用，适合知识库、文档问答。
5. 结构化长期记忆 Persistent Memory。存在于数据库、profile、知识图谱。包括MemoryBank、MemGPT、Mem0、Zep/Graphiti。适合多轮、多会话、个性化 agent。
6. 行为/过程记忆 Procedural Memory。存在于prompt、policy、workflow、工具使用规则。可更新 system prompt、few-shot 成功轨迹。让 agent 学会“怎么做事”，而不只是记事实。

## What to Memorize ?


## How to Memorize ?

## How to Retrieve  ?


## Video Long Memory
1. 稀疏/双层 Visual Memory
2. 外部 Memory Bank / Online Memory Bank
3. Streaming / Recurrent Memory
4. 层次化 / Memory Tree
5. Agentic Memory
