// ==UserScript==
// @name         Osir - Destaque de solicitações
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      1.7
// @description  Destaca as linhas da tabela por tipo de serviço e exibe legenda detalhada alinhada no ERP.
// @author       Lucashackd
// @match        https://erp.osirnet.com.br/authentication_contracts/get_authentication_informations/*
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/Lucashackd/Scripts-Osirnet
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20Destaque%20de%20troca%20de%20endere%C3%A7o.user.js
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20Destaque%20de%20troca%20de%20endere%C3%A7o.user.js
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
        BLUE: 'lightblue'           // Downgrade / Upgrade
    };

    // Renderiza a legenda alinhada na mesma altura do filtro de pesquisa
    function renderLegend() {
        const wrapper = document.getElementById('solicitations-table_wrapper');
        const filter = document.getElementById('solicitations-table_filter');

        // Evita duplicar a legenda se ela já estiver presente no DOM
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

        // Insere a legenda antes do elemento de filtro para flutuarem lado a lado na mesma altura
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

    // Função principal que orquestra a legenda e a pintura
    function updateUI() {
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
