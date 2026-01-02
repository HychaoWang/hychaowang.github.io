document.addEventListener('DOMContentLoaded', function() {
    // 查找所有代码高亮容器
    const highlights = document.querySelectorAll('.highlight');

    highlights.forEach(function(highlight) {
        // 创建复制按钮
        const btn = document.createElement('button');
        btn.className = 'copy-code-btn';
        btn.innerText = 'Copy';

        // 将按钮添加到容器中
        highlight.appendChild(btn);

        // 点击事件
        btn.addEventListener('click', function() {
            // 获取代码文本
            // 尝试处理两种情况：
            // 1. 直接是 pre code (无行号或 inline 行号)
            // 2. 表格布局 (带行号)
            
            let codeText = '';
            
            // 检查是否是表格布局
            const table = highlight.querySelector('table');
            if (table) {
                // 如果是表格，代码通常在最后一个 td 中
                const codeTd = table.querySelector('td:last-child');
                if (codeTd) {
                    // 获取 td 中的文本，但要注意有些主题可能会在行号和代码之间加东西
                    // Chroma 默认这里面会有 pre 和 code 标签
                    codeText = codeTd.innerText;
                }
            } else {
                // 非表格布局，直接获取 pre 的文本
                const pre = highlight.querySelector('pre');
                if (pre) {
                    codeText = pre.innerText;
                }
            }

            // 执行复制
            if (navigator.clipboard) {
                navigator.clipboard.writeText(codeText).then(function() {
                    showSuccess(btn);
                }).catch(function(err) {
                    console.error('Could not copy text: ', err);
                    fallbackCopyTextToClipboard(codeText, btn);
                });
            } else {
                fallbackCopyTextToClipboard(codeText, btn);
            }
        });
    });

    function fallbackCopyTextToClipboard(text, btn) {
        var textArea = document.createElement("textarea");
        textArea.value = text;
        
        // 避免滚动到底部
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            var successful = document.execCommand('copy');
            if (successful) {
                showSuccess(btn);
            } else {
                btn.innerText = 'Failed';
                setTimeout(() => btn.innerText = 'Copy', 2000);
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            btn.innerText = 'Failed';
            setTimeout(() => btn.innerText = 'Copy', 2000);
        }

        document.body.removeChild(textArea);
    }

    function showSuccess(btn) {
        const originalText = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(function() {
            btn.innerText = originalText;
        }, 2000);
    }
});

