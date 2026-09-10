// ==UserScript==
// @name         Osir - Acessar Contrato na Etiqueta
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      1.3
// @description  Extrai o número do contrato da página e abre no painel em uma nova guia, com validação de exibição.
// @author       Lucas Hackbart Döhnert
// @match        https://erp.osirnet.com.br/ui/*/legacy/operations/*
// @match        https://erp.osirnet.com.br/legacy/operations/*
// @match        *://*.osirnet.com.br/ui/*/legacy/operations/*
// @match        *://*.osirnet.com.br/*
// @grant        none
// @license      MIT
// @homepage     https://github.com/Lucashackd/Scripts-Osirnet
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20Acessar%20Contrato%20na%20Etiqueta.js
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20Acessar%20Contrato%20na%20Etiqueta.js
// ==/UserScript==

(function() {
    'use strict';

    const buttonId = 'btn-abrir-contrato-tampermonkey';

    // CSS ajustado para se comportar bem dentro de uma Toolbar
    const buttonStyles = `
        margin-right: 16px;
        padding: 6px 16px;
        background-color: #f2f2f2;
        color: #09536F;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: Roboto, Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: background-color 0.2s;
    `;

    // Função que verifica se os elementos existem e retorna o número do contrato
    function getNumeroContrato() {
        // Pega todos os subtítulos na tela
        const subtitulos = document.querySelectorAll('h6.MuiTypography-root.MuiTypography-subtitle1');

        for (let h6 of subtitulos) {
            // Verifica se o texto exato do subtítulo é "Número:"
            if (h6.textContent.trim() === 'Número:') {
                // Procura o elemento <p> irmão (que vem logo depois do <h6> dentro da mesma div)
                const pValue = h6.nextElementSibling;

                // Se o <p> existe e tem as classes corretas, retornamos o valor dele
                if (pValue && pValue.tagName.toLowerCase() === 'p' && pValue.classList.contains('MuiTypography-body1')) {
                    const valor = pValue.textContent.trim();
                    if (valor) return valor;
                }
            }
        }
        return null; // Retorna null se não achar a estrutura ou o valor
    }

    function injectButton() {
        // Verifica se a estrutura do contrato (Número: XXXX) está na tela
        const numeroContrato = getNumeroContrato();

        // Procura o container da Toolbar
        const container = document.querySelector('.MuiToolbar-root.MuiToolbar-regular.MuiToolbar-gutters');
        const existingBtn = document.getElementById(buttonId);

        // Se não encontrar o número do contrato OU não encontrar a Toolbar,
        // removemos o botão caso ele já exista (útil se o usuário trocar de página no sistema) e paramos.
        if (!numeroContrato || !container) {
            if (existingBtn) existingBtn.remove();
            return;
        }

        // Evita duplicar o botão se ele já foi inserido e deve continuar na tela
        if (existingBtn) return;

        const btn = document.createElement('button');
        btn.id = buttonId;
        btn.style.cssText = buttonStyles;

        btn.innerHTML = `
            Contrato
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
        `;

        btn.onmouseover = () => btn.style.backgroundColor = '#ffffff';
        btn.onmouseout = () => btn.style.backgroundColor = '#f2f2f2';

        btn.addEventListener('click', () => {
            // Buscamos o valor novamente no clique para garantir que estamos pegando o mais atualizado
            const valorCapturado = getNumeroContrato();

            if (valorCapturado) {
                const baseUrl = 'https://erp.osirnet.com.br/authentication_contracts/contract_panel/';
                window.open(baseUrl + encodeURIComponent(valorCapturado), '_blank');
            } else {
                alert('Não foi possível ler o número do contrato no momento do clique.');
            }
        });

        // Adiciona o botão dentro da Toolbar
        container.prepend(btn);
    }

    // Observa mudanças na página para injetar ou remover o botão dinamicamente
    const observer = new MutationObserver(() => {
        injectButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Tenta renderizar assim que carregar
    injectButton();
})();
