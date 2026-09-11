// ==UserScript==
// @name         Osir - Destaque de solicitações
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      2.0
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
        SELECTED: '#141414'         // Linha mãe selecionada (Preto suave)
    };

    // Injeta o CSS garantindo que o estilo de seleção afete apenas as células diretas da linha mãe
    function injectSelectionStyles() {
        if (document.getElementById('custom-selection-styles')) return;

        const style = document.createElement('style');
        style.id = 'custom-selection-styles';
        style.textContent = `
            /* Anula seleções amarelas padrão da tabela */
            #solicitations-table tbody tr.selected,
            #solicitations-table tbody tr.active,
            #solicitations-table tbody tr.row_selected {
                background-color: transparent !important;
            }

            /* Estilo da linha mãe selecionada aplicável apenas às suas células diretas (> td) */
            #solicitations-table tbody tr.custom-selected > td,
            #solicitations-table tbody tr.custom-selected > td > span,
            #solicitations-table tbody tr.custom-selected > td > i {
                background-color: ${COLORS.SELECTED} !important;
                color: #ffffff !important;
            }

            /* Reseta e protege o conteúdo interno da sub-linha expandida (.td-information) para manter visual original */
            #solicitations-table tbody tr td.td-information {
                background-color: #ffffff !important;
                color: #333333 !important;
            }

            #solicitations-table tbody tr td.td-information * {
                color: initial;
            }
        `;
        document.head.appendChild(style);
    }

    // Configura a seleção da linha mãe ao clicar (ignorando sub-linhas e áreas de detalhes expandidas)
    function setupRowSelection() {
        if (document.body.dataset.selectionInitialized) return;
        document.body.dataset.selectionInitialized = 'true';

        document.addEventListener('click', (event) => {
            // Evita disparar a seleção ao clicar dentro do conteúdo expandido (.td-information)
            if (event.target.closest('td.td-information')) {
                return;
            }

            // Seleciona a linha principal
            const row = event.target.closest('#solicitations-table tbody tr');
            if (!row || row.querySelector('td.td-information')) return;

            // Remove seleções e turbações padrão do site de todas as linhas
            document.querySelectorAll('#solicitations-table tbody tr').forEach(r => {
                r.classList.remove('custom-selected', 'selected', 'active', 'row_selected');
            });

            // Aplica a seleção de forma fixa à linha clicada (não alterna para desligado)
            row.classList.add('custom-selected');

            highlightRows();
        });
    }

    // Renderiza a legenda alinhada à barra de busca
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
            <strong style="margin-right: 2px; color: #555;">Legenda:</strong>
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

    // Função responsável por aplicar os destaques apenas nas linhas mãe
    function highlightRows() {
        const rows = document.querySelectorAll('#solicitations-table tbody tr');

        rows.forEach(row => {
            // Ignora se for sub-linha (.td-information) ou a linha mãe selecionada (preta)
            if (row.classList.contains('custom-selected') || row.querySelector('td.td-information')) {
                return;
            }

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

                if (highlightColor) {
                    row.style.setProperty('background-color', highlightColor, 'important');
                } else {
                    row.style.removeProperty('background-color');
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
