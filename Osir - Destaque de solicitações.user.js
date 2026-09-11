// ==UserScript==
// @name         Osir - Destaque de solicitações
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      1.3
// @description  Destaca as linhas da tabela de solicitações por tipo de serviço no ERP.
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
        PINK: 'lightpink',      // Troca + Endereço (Rosa claro)
        ORANGE: '#ffe0b2',     // Manutenção (Laranja claro)
        GREEN: 'lightgreen',    // Ativação / Habilitação fibra (Verde claro)
        BLUE: 'lightblue'       // Downgrade / Upgrade (Azul claro)
    };

    // Função responsável por aplicar os destaques
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
                // 2. Manutenção (Laranja claro)
                else if (titleText.includes('manutenção')) {
                    highlightColor = COLORS.ORANGE;
                }
                // 3. Ativação OU "habilitação fibra" na sequência exata (Verde claro)
                else if (titleText.includes('ativação') || titleText.includes('habilitação fibra')) {
                    highlightColor = COLORS.GREEN;
                }
                // 4. Downgrade OU Upgrade (Azul claro)
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

    // Executa no carregamento inicial da página
    highlightRows();

    // Observador para atualizações dinâmicas, ordenação e paginação
    const observer = new MutationObserver(() => {
        highlightRows();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
