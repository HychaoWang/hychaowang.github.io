const papers = [
  {
    paper: "Radial Attention",
    authors: "Li et al.",
    category: "training-free",
    pattern: "Static radial",
    benchmark: "HunyuanVideo",
    task: "T2V",
    psnr: 27.3,
    ssim: 0.886,
    lpips: 0.114,
    latency: 876,
    speedup: 1.88,
    setup: "117 frames · 768p · 1× H100",
    year: 2025,
  },
  {
    paper: "Radial Attention",
    authors: "Li et al.",
    category: "training-free",
    pattern: "Static radial",
    benchmark: "Wan2.1-14B",
    task: "T2V",
    psnr: 23.9,
    ssim: 0.842,
    lpips: 0.163,
    latency: 917,
    speedup: 1.77,
    setup: "69 frames · 768p · 1× H100",
    year: 2025,
  },
  {
    paper: "Radial Attention (LoRA)",
    authors: "Li et al.",
    category: "training-based",
    pattern: "Static radial",
    benchmark: "Mochi 1",
    task: "T2V",
    psnr: null,
    ssim: null,
    lpips: null,
    latency: 386,
    speedup: 2.57,
    quality: 0.638,
    qualityLabel: "VBench I.Q.",
    visionReward: 0.113,
    sparsity: "85.5%",
    trainingCost: "17.4h",
    setup: "667 frames · 4× extension · LoRA",
    year: 2025,
  },
  {
    paper: "Radial Attention (LoRA)",
    authors: "Li et al.",
    category: "training-based",
    pattern: "Static radial",
    benchmark: "HunyuanVideo",
    task: "T2V",
    psnr: null,
    ssim: null,
    lpips: null,
    latency: 339,
    speedup: 2.35,
    quality: 0.663,
    qualityLabel: "VBench I.Q.",
    visionReward: 0.126,
    sparsity: "80.8%",
    trainingCost: "16.2h",
    setup: "253 frames · 2× extension · LoRA",
    year: 2025,
  },
  {
    paper: "Radial Attention (LoRA)",
    authors: "Li et al.",
    category: "training-based",
    pattern: "Static radial",
    benchmark: "HunyuanVideo",
    task: "T2V",
    psnr: null,
    ssim: null,
    lpips: null,
    latency: 781,
    speedup: 3.71,
    quality: 0.672,
    qualityLabel: "VBench I.Q.",
    visionReward: 0.134,
    sparsity: "88.3%",
    trainingCost: "21.4h",
    setup: "509 frames · 4× extension · LoRA",
    year: 2025,
  },
  {
    paper: "Radial Attention (LoRA)",
    authors: "Li et al.",
    category: "training-based",
    pattern: "Static radial",
    benchmark: "Mochi 1",
    task: "T2V",
    psnr: null,
    ssim: null,
    lpips: null,
    latency: 185,
    speedup: 1.63,
    quality: 0.602,
    qualityLabel: "VBench I.Q.",
    visionReward: 0.110,
    sparsity: "76.4%",
    trainingCost: "8.43h",
    setup: "331 frames · 2× extension · LoRA",
    year: 2025,
  },
  {
    paper: "Radial Attention (LoRA)",
    authors: "Li et al.",
    category: "training-based",
    pattern: "Static radial",
    benchmark: "Wan2.1-14B",
    task: "T2V",
    psnr: null,
    ssim: null,
    lpips: null,
    latency: 2847,
    speedup: 2.01,
    quality: 0.677,
    qualityLabel: "VBench I.Q.",
    visionReward: 0.145,
    sparsity: "73.6%",
    trainingCost: "14.5h",
    setup: "161 frames · 2× extension · LoRA",
    year: 2025,
  },
  {
    paper: "AdaSpa",
    authors: "Xia et al.",
    category: "training-free",
    pattern: "Adaptive block sparse",
    benchmark: "HunyuanVideo",
    task: "T2V",
    psnr: 29.07,
    ssim: 0.8905,
    lpips: 0.1478,
    latency: 1810.23,
    speedup: 1.78,
    setup: "129 frames · 720p · 1× A100-80GB",
    year: 2025,
  },
  {
    paper: "AdaSpa",
    authors: "Xia et al.",
    category: "training-free",
    pattern: "Adaptive block sparse",
    benchmark: "CogVideoX1.5-5B",
    task: "T2V",
    psnr: 23.25,
    ssim: 0.8267,
    lpips: 0.2067,
    latency: 1888.14,
    speedup: 1.66,
    setup: "161 frames · 720p · 1× A100-80GB",
    year: 2025,
  },
  {
    paper: "Sparse VideoGen2",
    authors: "Yang et al.",
    category: "training-free",
    pattern: "Semantic permutation",
    benchmark: "HunyuanVideo",
    task: "T2V",
    psnr: 30.452,
    ssim: 0.910,
    lpips: 0.117,
    latency: 780,
    latencyLabel: "≈780s",
    speedup: 2.30,
    setup: "33 frames · 720p · 1× H100 · 30% warmup",
    year: 2026,
  },
  {
    paper: "Sparse VideoGen2",
    authors: "Yang et al.",
    variant: "FP8",
    category: "training-free",
    pattern: "Semantic permutation",
    benchmark: "HunyuanVideo",
    task: "T2V",
    psnr: 30.389,
    ssim: 0.908,
    lpips: 0.118,
    latency: 706,
    latencyLabel: "≈706s",
    speedup: 2.55,
    setup: "33 frames · 720p · 1× H100 · 30% warmup · FP8",
    year: 2026,
  },
  {
    paper: "Sparse VideoGen2",
    authors: "Yang et al.",
    category: "training-free",
    pattern: "Semantic permutation",
    benchmark: "Wan2.1-14B",
    task: "T2V",
    psnr: 25.808,
    ssim: 0.854,
    lpips: 0.138,
    latency: 960,
    latencyLabel: "≈960s",
    speedup: 1.60,
    setup: "21 frames · 720p · 1× H100 · 30% warmup",
    year: 2026,
  },
  {
    paper: "Sparse VideoGen2",
    authors: "Yang et al.",
    variant: "Turbo",
    category: "training-free",
    pattern: "Semantic permutation",
    benchmark: "Wan2.1-14B",
    task: "T2V",
    psnr: 23.682,
    ssim: 0.789,
    lpips: 0.196,
    latency: 952,
    latencyLabel: "≈952s",
    speedup: 1.89,
    setup: "21 frames · 720p · 1× H100 · 30% warmup · Turbo",
    year: 2026,
  },
  {
    paper: "Sparse VideoGen2",
    authors: "Yang et al.",
    variant: "I2V",
    category: "training-free",
    pattern: "Semantic permutation",
    benchmark: "Wan2.1-14B",
    task: "I2V",
    psnr: 26.562,
    ssim: 0.861,
    lpips: 0.138,
    latency: 1140,
    latencyLabel: "≈1140s",
    speedup: 1.58,
    setup: "21 frames · 720p · 1× H100 · 30% warmup",
    year: 2026,
  },
  {
    paper: "Sparse VideoGen2",
    authors: "Yang et al.",
    variant: "I2V Turbo",
    category: "training-free",
    pattern: "Semantic permutation",
    benchmark: "Wan2.1-14B",
    task: "I2V",
    psnr: 24.510,
    ssim: 0.812,
    lpips: 0.179,
    latency: 978,
    latencyLabel: "≈978s",
    speedup: 1.84,
    setup: "21 frames · 720p · 1× H100 · 30% warmup · Turbo",
    year: 2026,
  },
  {
    paper: "Sliding Tile Attention",
    authors: "Zhang et al.",
    category: "training-free",
    pattern: "Sliding tile",
    benchmark: "HunyuanVideo",
    task: "T2V",
    psnr: 28.76,
    ssim: 0.8767,
    lpips: null,
    latency: 501,
    speedup: 1.89,
    setup: "117 frames · 768p · 1× H100 · 50 steps",
    year: 2025,
  },
  {
    paper: "Sliding Tile Attention",
    authors: "Zhang et al.",
    category: "training-free",
    pattern: "Sliding tile",
    benchmark: "Wan2.1-14B",
    task: "T2V",
    psnr: 24.42,
    ssim: 0.8581,
    lpips: null,
    latency: 730,
    speedup: 1.60,
    setup: "69 frames · 1× H100 · 50 steps",
    year: 2025,
  },
  {
    paper: "SpargeAttention2",
    authors: "Zhang et al.",
    category: "training-based",
    pattern: "Hybrid Top-k + Top-p",
    benchmark: "Wan2.1-14B",
    task: "T2V",
    psnr: null,
    ssim: null,
    lpips: null,
    latency: 650,
    speedup: 4.7,
    quality: 69.08,
    qualityLabel: "VBench IQ",
    visionReward: 0.1149,
    sparsity: "95%",
    trainingCost: "N/R",
    setup: "720p · 1× RTX 5090 · E2E",
    year: 2026,
  },
  {
    paper: "SpargeAttention2",
    authors: "Zhang et al.",
    category: "training-based",
    pattern: "Hybrid Top-k + Top-p",
    benchmark: "Wan2.1-1.3B",
    task: "T2V",
    psnr: null,
    ssim: null,
    lpips: null,
    latency: 68,
    speedup: 2.34,
    quality: 67.68,
    qualityLabel: "VBench IQ",
    visionReward: 0.1010,
    sparsity: "95%",
    trainingCost: "N/R",
    setup: "480p · 1× RTX 5090 · E2E",
    year: 2026,
  },
];

const paperTitles = {
  "Radial Attention": "Radial Attention: O(n log n) Sparse Attention with Energy Decay for Long Video Generation",
  "Radial Attention (LoRA)": "Radial Attention: O(n log n) Sparse Attention with Energy Decay for Long Video Generation",
  "AdaSpa": "Training-free and Adaptive Sparse Attention for Efficient Long Video Generation",
  "Sparse VideoGen2": "Sparse VideoGen2: Accelerate Video Generation with Sparse Attention via Semantic-Aware Permutation",
  "Sliding Tile Attention": "Fast Video Generation with Sliding Tile Attention",
  "SpargeAttention2": "SpargeAttention2: Trainable Sparse Attention via Hybrid Top-k + Top-p Masking and Distillation Fine-Tuning",
};

const mesh = document.getElementById("meshGrid");
const searchInput = document.getElementById("searchInput");
const patternFilter = document.getElementById("patternFilter");
const benchmarkFilter = document.getElementById("benchmarkFilter");
const yearFilter = document.getElementById("yearFilter");
const leaderboardTables = document.getElementById("leaderboardTables");
const resultCount = document.getElementById("resultCount");
const chartArea = document.getElementById("chartArea");
let sortKey = "speedup";
let sortDirection = -1;

for (let i = 0; i < 128; i += 1) {
  const dot = document.createElement("span");
  if (i % 17 === 0 || i % 15 === 0 || (i > 40 && i < 49) || (i > 87 && i < 96)) dot.className = "lit";
  if (i === 47 || i === 80 || i === 111) dot.className = "hot";
  mesh.append(dot);
}

const getFiltered = () => {
  const query = searchInput.value.trim().toLowerCase();
  return papers
    .filter(item => patternFilter.value === "all" || item.pattern === patternFilter.value)
    .filter(item => benchmarkFilter.value === "all" || item.benchmark === benchmarkFilter.value)
    .filter(item => yearFilter.value === "all" || item.year === Number(yearFilter.value))
    .filter(item => !query || `${item.paper} ${item.authors}`.toLowerCase().includes(query))
    .sort((a, b) => {
      if (typeof a[sortKey] === "string") return a[sortKey].localeCompare(b[sortKey]) * sortDirection;
      return (a[sortKey] - b[sortKey]) * sortDirection;
    });
};

const boardMeta = {
  "training-based": ["Training-based methods", "Sparse attention learned or adapted during training"],
  "training-free": ["Training-free methods", "Drop-in sparse inference without additional training"],
};
const trainingFreeHead = `
  <thead><tr>
    <th class="rank-cell">#</th><th data-sort="paper">Method <span>↕</span></th>
    <th data-sort="pattern">Pattern <span>↕</span></th><th data-sort="benchmark">Model <span>↕</span></th>
    <th data-sort="task">Task <span>↕</span></th>
    <th data-sort="psnr">PSNR ↑ <span>↕</span></th>
    <th data-sort="ssim">SSIM ↑ <span>↕</span></th><th data-sort="lpips">LPIPS ↓ <span>↕</span></th>
    <th data-sort="latency">Latency ↓ <span>↕</span></th><th data-sort="speedup">Speedup ↑ <span>↕</span></th>
    <th data-sort="setup">Reported setup <span>↕</span></th>
  </tr></thead>`;
const trainingBasedHead = `
  <thead><tr>
    <th class="rank-cell">#</th><th data-sort="paper">Method <span>↕</span></th>
    <th data-sort="pattern">Pattern <span>↕</span></th><th data-sort="benchmark">Model <span>↕</span></th>
    <th data-sort="task">Task <span>↕</span></th>
    <th data-sort="quality">Quality ↑ <span>↕</span></th><th data-sort="visionReward">Vision Reward ↑ <span>↕</span></th>
    <th data-sort="sparsity">Sparsity ↑ <span>↕</span></th><th data-sort="trainingCost">Training Cost ↓ <span>↕</span></th>
    <th data-sort="latency">Latency ↓ <span>↕</span></th><th data-sort="speedup">Speedup ↑ <span>↕</span></th>
    <th data-sort="setup">Reported setup <span>↕</span></th>
  </tr></thead>`;

function renderBoard(items, category) {
  const [title, description] = boardMeta[category];
  const body = items.length
    ? items.map((item, index) => `
      <tr>
        <td class="rank-cell">${String(index + 1).padStart(2, "0")}</td>
        <td><div class="paper-title"><strong class="method-name" title="${paperTitles[item.paper]}">${item.paper}</strong><small>${item.authors} · ${item.year}${item.variant ? ` · ${item.variant}` : ""}</small></div></td>
        <td><span class="tag">${item.pattern}</span></td>
        <td><span class="benchmark">${item.benchmark}</span></td>
        <td><span class="task-type">${item.task}</span></td>
        ${category === "training-based" ? `
        <td><span class="metric">${formatMetric(item.quality)}</span><small class="metric-label">${item.qualityLabel || ""}</small></td>
        <td>${formatMetric(item.visionReward)}</td>
        <td>${formatMetric(item.sparsity)}</td>
        <td>${formatMetric(item.trainingCost)}</td>` : `
        <td><span class="metric">${formatMetric(item.psnr)}</span></td>
        <td>${formatMetric(item.ssim)}</td>
        <td>${formatMetric(item.lpips)}</td>`}
        <td>${item.latencyLabel || `${item.latency}s`}</td>
        <td><span class="metric strong">${item.speedup}×</span></td>
        <td><span class="setup">${item.setup}</span></td>
      </tr>`).join("")
    : `<tr><td class="empty" colspan="${category === "training-based" ? 12 : 11}">No methods match these filters.</td></tr>`;
  return `<section class="board-block">
    <div class="board-title"><div><h3>${title}</h3><p>${description}</p></div><span class="board-count">${items.length} results</span></div>
    <div class="table-scroll"><table>${category === "training-based" ? trainingBasedHead : trainingFreeHead}<tbody>${body}</tbody></table></div>
    ${category === "training-based" ? `<p class="board-note"><strong>Quality metric note:</strong> <b>VBench IQ</b> is VBench Imaging Quality reported as a percentage by SpargeAttention2. <b>VBench-long I.Q.</b> is Image Quality on a 0–1 scale reported by Radial Attention for long-video evaluation. These values are not directly comparable.</p>` : ""}
  </section>`;
}

function renderTable(items) {
  leaderboardTables.innerHTML = ["training-based", "training-free"]
    .map(category => renderBoard(items.filter(item => item.category === category), category)).join("");
  resultCount.textContent = `Showing ${items.length} of ${papers.length} results`;
  bindSortHeaders();
}

function formatMetric(value) {
  return value == null ? "N/R" : value;
}

function renderChart(items) {
  chartArea.innerHTML = ["training-based", "training-free"].map(category => {
    const boardItems = items.filter(item => item.category === category);
    const max = Math.max(...boardItems.map(item => item.speedup), 1);
    const bars = boardItems.length ? boardItems.map(item => `
      <div class="chart-bar-wrap" title="${item.paper}${item.variant ? ` · ${item.variant}` : ""} · ${item.benchmark}: ${item.speedup}× speedup">
        <div class="chart-bar ${item.speedup === max ? "top" : ""}" style="height:${Math.round(item.speedup / max * 190)}px">${item.speedup}×</div>
        <div class="chart-bar-label">${item.paper.replace(" Attention", "").replace("Sparse ", "")}<br>${item.variant || item.benchmark}</div>
      </div>`).join("")
    : `<div class="empty">No methods match these filters.</div>`;
    return `<section class="chart-board"><div class="chart-board-title"><h4>${boardMeta[category][0]}</h4><span>${boardItems.length} results</span></div><div class="chart-area">${bars}</div></section>`;
  }).join("");
}

function render() {
  const filtered = getFiltered();
  renderTable(filtered);
  renderChart(filtered);
}

[searchInput, patternFilter, benchmarkFilter, yearFilter].forEach(control => control.addEventListener("input", render));
document.getElementById("resetFilters").addEventListener("click", () => {
  searchInput.value = "";
  patternFilter.value = "all";
  benchmarkFilter.value = "all";
  yearFilter.value = "all";
  render();
});
function bindSortHeaders() {
  document.querySelectorAll("th[data-sort]").forEach(th => th.addEventListener("click", () => {
    const nextKey = th.dataset.sort;
    sortDirection = sortKey === nextKey ? -sortDirection : nextKey === "paper" || nextKey === "pattern" || nextKey === "task" ? 1 : -1;
    sortKey = nextKey;
    render();
  }));
}
document.querySelectorAll(".view-toggle button").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".view-toggle button").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  document.getElementById("tableView").classList.toggle("hidden", button.dataset.view !== "table");
  document.getElementById("chartView").classList.toggle("hidden", button.dataset.view !== "chart");
}));

render();
