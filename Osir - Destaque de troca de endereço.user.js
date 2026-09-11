// ==UserScript==
// @name         Osir - Destaque de troca de endereço
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      1.0
// @description  Destaca as linhas da tabela que contêm "troca de endereço" na coluna Título.
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

    // Cor do fundo desejada (Azul Claro)
    const HIGHLIGHT_COLOR = 'lightblue'; // Você também pode usar valores em Hex como '#add8e6' ou '#e0f7fa'

    // Função responsável por verificar e destacar as linhas
    function highlightAddressExchangeRows() {
        // Seleciona todas as linhas da tabela de solicitações
        const rows = document.querySelectorAll('#solicitations-table tbody tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');

            // Verifica se existe a coluna "Título" (índice 1 -> 2ª célula)
            if (cells.length > 1) {
                const titleCellText = cells[1].textContent || cells[1].innerText;

                // Transforma em minúsculas para garantir a busca independente de caixa
                if (titleCellText.toLowerCase().includes('troca de endereço')) {
                    // Aplica a cor de fundo com !important para evitar sobrescrita pelo estilo da tabela
                    row.style.setProperty('background-color', HIGHLIGHT_COLOR, 'important');
                }
            }
        });
    }

    // Executa no carregamento inicial da página
    highlightAddressExchangeRows();

    // Observador (MutationObserver) para tratar atualizações dinâmicas, paginação e ordenação na tabela
    const observer = new MutationObserver((mutations) => {
        highlightAddressExchangeRows();
    });

    // Inicia a observação de alterações no DOM a partir do body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
