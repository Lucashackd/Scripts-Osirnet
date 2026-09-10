// ==UserScript==
// @name         Categorizador de Comandos OLT - Osirnet
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      1.2
// @description  Categoriza visualmente os botões e injeta uma legenda de cores.
// @author       Lucas Hackbart Döhnert
// @match        https://*.osirnet.com.br/*
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/Lucashackd/Scripts-Osirnet
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// ==/UserScript==

(function() {
    'use strict';

    function injectStyles() {
        if (document.getElementById('custom-olt-styles')) return;

        const style = document.createElement('style');
        style.id = 'custom-olt-styles';
        style.innerHTML = `
            /* ESTILOS DOS BOTÕES */
            span.action-button.categorized {
                border-radius: 4px;
                transition: all 0.2s ease-in-out;
            }

            span.action-button.cat-info { border-left: 4px solid #0ea5e9 !important; }
            span.action-button.cat-sinal { border-left: 4px solid #f59e0b !important; }
            span.action-button.cat-prov { border-left: 4px solid #10b981 !important; }
            span.action-button.cat-danger { border-left: 4px solid #ef4444 !important; }
            span.action-button.cat-system { border-left: 4px solid #8b5cf6 !important; }

            /* ESTILOS DA LEGENDA */
            #olt-category-legend {
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
                margin-bottom: 16px;
                padding: 10px 14px;
                background-color: rgba(0, 0, 0, 0.03); /* Fundo sutil */
                border: 1px solid rgba(0, 0, 0, 0.08);
                border-radius: 6px;
                font-family: inherit;
                font-size: 13px;
                font-weight: 500;
                color: #475569;
                width: 100%;
                box-sizing: border-box;
            }

            .olt-legend-item {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .olt-legend-color {
                width: 12px;
                height: 12px;
                border-radius: 3px;
            }

            /* CORES PARA OS QUADRADINHOS DA LEGENDA */
            .bg-info { background-color: #0ea5e9; }
            .bg-sinal { background-color: #f59e0b; }
            .bg-prov { background-color: #10b981; }
            .bg-danger { background-color: #ef4444; }
            .bg-system { background-color: #8b5cf6; }
        `;
        document.head.appendChild(style);
    }

    // Função para criar e injetar a legenda na tela
    function injectLegend() {
        // Evita duplicar a legenda
        if (document.getElementById('olt-category-legend')) return;

        // Procura o primeiro botão para descobrir quem é a Div container dele
        const firstButton = document.querySelector('span.action-button');
        if (!firstButton) return;

        const container = firstButton.parentElement;

        // Cria o elemento da legenda
        const legend = document.createElement('div');
        legend.id = 'olt-category-legend';

        legend.innerHTML = `
            <div class="olt-legend-item">
                <div class="olt-legend-color bg-info"></div>
                <span>Info / Consultas</span>
            </div>
            <div class="olt-legend-item">
                <div class="olt-legend-color bg-sinal"></div>
                <span>Sinal</span>
            </div>
            <div class="olt-legend-item">
                <div class="olt-legend-color bg-prov"></div>
                <span>Provisionamento / Bridge</span>
            </div>
            <div class="olt-legend-item">
                <div class="olt-legend-color bg-danger"></div>
                <span>Ações Críticas</span>
            </div>
            <div class="olt-legend-item">
                <div class="olt-legend-color bg-system"></div>
                <span>Sistema / Scripts</span>
            </div>
        `;

        // Prepend adiciona a legenda como o primeiro item dentro da div, logo acima dos botões
        container.prepend(legend);
    }

    function categorizeButtons() {
        const buttons = document.querySelectorAll('span.action-button:not(.categorized)');

        if (buttons.length > 0) {
            // Se encontrou botões novos, garante que a legenda está na tela
            injectLegend();
        }

        buttons.forEach(btn => {
            const title = (btn.getAttribute('title') || '').toLowerCase();
            btn.classList.add('categorized');

            if (title.includes('sinal') || title.includes('sinais')) {
                btn.classList.add('cat-sinal');
            }
            else if (
                title.includes('provisionamento') ||
                title.includes('pt 1') ||
                title.includes('pt 2') ||
                title.includes('pt 3') ||
                title.includes('bridge') ||
                title.includes('router') ||
                title.includes('telefonia')
            ) {
                btn.classList.add('cat-prov');
            }
            else if (title.includes('deleta') || title.includes('reiniciar')) {
                btn.classList.add('cat-danger');
            }
            else if (
                title.includes('info') ||
                title.includes('status') ||
                title.includes('lista') ||
                title.includes('mac') ||
                title.includes('busca') ||
                title.includes('verificar') ||
                title.includes('exibir') ||
                title.includes('show')
            ) {
                btn.classList.add('cat-info');
            }
            else if (
                title.includes('salvar') ||
                title.includes('retomar') ||
                title.includes('script')
            ) {
                btn.classList.add('cat-system');
            }
            else {
                btn.classList.add('cat-system');
            }
        });
    }

    const observer = new MutationObserver((mutations) => {
        let shouldRun = false;
        for (let mutation of mutations) {
            // Verifica se nós foram adicionados ou se a legenda foi removida pelo React
            if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                shouldRun = true;
                break;
            }
        }

        if (shouldRun) {
            categorizeButtons();
            // Também re-checa a legenda no caso do React ter re-renderizado a Div inteira
            if (document.querySelector('span.action-button') && !document.getElementById('olt-category-legend')) {
                injectLegend();
            }
        }
    });

    injectStyles();
    observer.observe(document.body, { childList: true, subtree: true });
    categorizeButtons();
})();
