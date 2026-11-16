function setupPanelControls() {
  const shell = document.querySelector<HTMLElement>(".site-shell");
  const header = document.querySelector<HTMLElement>(".site-header");
  const name = document.querySelector<HTMLElement>(".site-name");
  const content = document.querySelector<HTMLElement>("#site-content");
  const controls = document.querySelector<HTMLElement>(".panel-controls");
  const collapseButton = document.querySelector<HTMLButtonElement>("[data-panel-collapse]");
  const expandButton = document.querySelector<HTMLButtonElement>("[data-panel-expand]");
  if (!shell || !header || !name || !content || !controls || !collapseButton || !expandButton) return;

  controls.hidden = false;
  let animation: Animation | null = null;
  let headerAnimations: Animation[] = [];
  const movingElements = [name];

  const setCollapsed = (collapsed: boolean) => {
    const startHeight = shell.getBoundingClientRect().height;
    const startPositions = movingElements.map((element) => element.getBoundingClientRect());
    animation?.cancel();
    headerAnimations.forEach((animation) => animation.cancel());
    shell.style.height = "";
    shell.classList.remove("is-animating");
    shell.classList.toggle("is-collapsed", collapsed);
    content.hidden = false;
    content.inert = collapsed;
    collapseButton.hidden = collapsed;
    expandButton.hidden = !collapsed;
    collapseButton.setAttribute("aria-expanded", String(!collapsed));
    expandButton.setAttribute("aria-expanded", String(!collapsed));
    (collapsed ? expandButton : collapseButton).focus({ preventScroll: true });

    const endHeight = collapsed
      ? header.getBoundingClientRect().height
      : shell.getBoundingClientRect().height;

    const finish = () => {
      content.hidden = collapsed;
      shell.style.height = "";
      shell.classList.remove("is-animating");
      animation = null;
      headerAnimations = [];
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    shell.classList.add("is-animating");
    shell.style.height = `${endHeight}px`;
    const timing = { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
    // Keep the name moving smoothly while the corner controls stay fixed.
    headerAnimations = movingElements.map((element, index) => {
      const endPosition = element.getBoundingClientRect();
      const startPosition = startPositions[index];
      return element.animate(
        [
          { transform: `translate(${startPosition.left - endPosition.left}px, ${startPosition.top - endPosition.top}px)` },
          { transform: "translate(0, 0)" },
        ],
        timing
      );
    });
    animation = shell.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      timing
    );
    animation.onfinish = finish;
  };

  collapseButton.addEventListener("click", () => setCollapsed(true));
  expandButton.addEventListener("click", () => setCollapsed(false));
}

document.addEventListener("astro:page-load", setupPanelControls);
