// ==UserScript==
// @name         Osir - Destaque de solicitações
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      1.8
// @description  Destaca as linhas da tabela por tipo de serviço e exibe legenda detalhada alinhada no ERP.
// @author       Lucashackd
// @match        https://erp.osirnet.com.br/authentication_contracts/get_authentication_informations/*
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/Lucashackd/Scripts-Osirnet
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20Destaque%20de%20solicita%C3%A7%C3%B5es.user.js
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20Destaque%20de%20solicita%C3%A7%C3%B5es.user.js
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// ==/UserScript==

(function() {
    'use strict';

    // Definição das cores de destaque
    const COLORS = {
        PINK: 'lightpink',           // Troca + Endereço
        ORANGE: '#ffe0b2',          // Manutenção (Laranja claro)
        ORANGE_LIGHT: '#fff3e0',    // Apoio Manut. Fibra (Laranja mais claro)
        GREEN: '#a5d6a7',           // Ativação (Verde claro)
        GREEN_LIGHT: '#e8f5e9',     // Habilitação Fibra (Verde muito claro)
        BLUE: 'lightblue',          // Downgrade / Upgrade
        SELECTED: '#141414'         // Linha selecionada (Preto suave)
    };

    // Injeta o CSS para garantir que a linha selecionada se sobressaia com texto branco
    function injectSelectionStyles() {
        if (document.getElementById('custom-selection-styles')) return;

        const style = document.createElement('style');
        style.id = 'custom-selection-styles';
        style.textContent = `
            #solicitations-table tbody tr.custom-selected,
            #solicitations-table tbody tr.custom-selected td,
            #solicitations-table tbody tr.custom-selected span,
            #solicitations-table tbody tr.custom-selected i {
                background-color: ${COLORS.SELECTED} !important;
                color: #ffffff !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Configura a seleção da linha via clique usando delegação de eventos
    function setupRowSelection() {
        if (document.body.dataset.selectionInitialized) return;
        document.body.dataset.selectionInitialized = 'true';

        document.addEventListener('click', (event) => {
            const row = event.target.closest('#solicitations-table tbody tr');
            if (!row) return;

            const wasSelected = row.classList.contains('custom-selected');

            // Remove a seleção de outras linhas (seleção única)
            document.querySelectorAll('#solicitations-table tbody tr.custom-selected').forEach(r => {
                r.classList.remove('custom-selected');
            });

            // Alterna a seleção da linha clicada
            if (!wasSelected) {
                row.classList.add('custom-selected');
            }
        });
    }

    // Renderiza a legenda alinhada na mesma altura do filtro de pesquisa
    function renderLegend() {
        const wrapper = document.getElementById('solicitations-table_wrapper');
        const filter = document.getElementById('solicitations-table_filter');
        
        if (!wrapper || document.getElementById('solicitations-table-legend')) return;

        const legendContainer = document.createElement('div');
        legendContainer.id = 'solicitations-table-legend';
        legendContainer.style.cssText = `
            float: left;
            display: inline-flex;
            align-items: center;
            gap: 12px;
            margin-top: 4px;
            margin-bottom: 8px;
            padding: 4px 10px;
            background-color: #f8f9fa;
            border: 1px solid #dcdcdc;
            border-radius: 4px;
            font-size: 12px;
            color: #333;
            flex-wrap: wrap;
            line-height: 22px;
        `;

        legendContainer.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="width: 12px; height: 12px; background-color: ${COLORS.PINK}; border-radius: 3px; border: 1px solid #ccc; display: inline-block;"></span> Troca de Endereço
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="width: 12px; height: 12px; background-color: ${COLORS.ORANGE}; border-radius: 3px; border: 1px solid #ccc; display: inline-block;"></span> Manutenção
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="width: 12px; height: 12px; background-color: ${COLORS.ORANGE_LIGHT}; border-radius: 3px; border: 1px solid #ccc; display: inline-block;"></span> Apoio Manut. Fibra
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="width: 12px; height: 12px; background-color: ${COLORS.GREEN}; border-radius: 3px; border: 1px solid #ccc; display: inline-block;"></span> Ativação
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="width: 12px; height: 12px; background-color: ${COLORS.GREEN_LIGHT}; border-radius: 3px; border: 1px solid #ccc; display: inline-block;"></span> Habilitação Fibra
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="width: 12px; height: 12px; background-color: ${COLORS.BLUE}; border-radius: 3px; border: 1px solid #ccc; display: inline-block;"></span> Downgrade / Upgrade
            </span>
        `;

        if (filter) {
            filter.parentNode.insertBefore(legendContainer, filter);
        } else {
            wrapper.prepend(legendContainer);
        }
    }

    // Função responsável por aplicar os destaques nas linhas
    function highlightRows() {
        const rows = document.querySelectorAll('#solicitations-table tbody tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');

            if (cells.length > 1) {
                const titleText = (cells[1].textContent || cells[1].innerText).toLowerCase();
                let highlightColor = null;

                // 1. Troca de Endereço (Rosa claro)
                if (titleText.includes('troca') && titleText.includes('endereço')) {
                    highlightColor = COLORS.PINK;
                }
                // 2. Apoio Manut. Fibra (Laranja mais claro)
                else if (titleText.includes('apoio manut')) {
                    highlightColor = COLORS.ORANGE_LIGHT;
                }
                // 3. Manutenção (Laranja claro)
                else if (titleText.includes('manutenção')) {
                    highlightColor = COLORS.ORANGE;
                }
                // 4. Habilitação Fibra (Verde muito claro)
                else if (titleText.includes('habilitação fibra')) {
                    highlightColor = COLORS.GREEN_LIGHT;
                }
                // 5. Ativação (Verde claro)
                else if (titleText.includes('ativação')) {
                    highlightColor = COLORS.GREEN;
                }
                // 6. Downgrade OU Upgrade (Azul claro)
                else if (titleText.includes('downgrade') || titleText.includes('upgrade')) {
                    highlightColor = COLORS.BLUE;
                }

                // Aplica a cor de fundo se alguma regra for atendida
                if (highlightColor) {
                    row.style.setProperty('background-color', highlightColor, 'important');
                }
            }
        });
    }

    // Função principal de atualização de UI
    function updateUI() {
        injectSelectionStyles();
        setupRowSelection();
        renderLegend();
        highlightRows();
    }

    // Executa no carregamento inicial
    updateUI();

    // Observador para atualizações dinâmicas, ordenação e paginação
    const observer = new MutationObserver(() => {
        updateUI();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
