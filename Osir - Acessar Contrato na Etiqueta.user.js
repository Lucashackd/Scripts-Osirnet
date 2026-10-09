// ==UserScript==
// @name         Osir - Acessar Contrato na Etiqueta
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      1.5
// @description  Abre o contrato e acessa automaticamente o link da terceira coluna somente quando aberto pelo botão.
// @author       Lucas Hackbart Döhnert
// @match        https://erp.osirnet.com.br/ui/*/legacy/operations/*
// @match        https://erp.osirnet.com.br/legacy/operations/*
// @match        https://erp.osirnet.com.br/authentication_contracts/contract_panel/*
// @match        *://*.osirnet.com.br/ui/*/legacy/operations/*
// @match        *://*.osirnet.com.br/*
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/Lucashackd/Scripts-Osirnet
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20Acessar%20Contrato%20na%20Etiqueta.user.js
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20Acessar%20Contrato%20na%20Etiqueta.user.js
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// ==/UserScript==

(function () {
    'use strict';

    const buttonId = 'btn-abrir-contrato-tampermonkey';

    // Parâmetro exclusivo para identificar a abertura pelo botão.
    const autoClickParam = 'tm_auto_contrato';
    const autoClickValue = '1';

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

    // =========================================================
    // ETAPA 1: IDENTIFICAR O NÚMERO DO CONTRATO
    // =========================================================

    function getNumeroContrato() {
        const subtitulos = document.querySelectorAll(
            'h6.MuiTypography-root.MuiTypography-subtitle1'
        );

        for (const h6 of subtitulos) {
            if (h6.textContent.trim() !== 'Número:') {
                continue;
            }

            const pValue = h6.nextElementSibling;

            if (
                pValue &&
                pValue.tagName.toLowerCase() === 'p' &&
                pValue.classList.contains('MuiTypography-body1')
            ) {
                const valor = pValue.textContent.trim();

                if (valor) {
                    return valor;
                }
            }
        }

        return null;
    }

    // =========================================================
    // ETAPA 2: INJETAR O BOTÃO CONTRATO
    // =========================================================

    function injectButton() {
        const numeroContrato = getNumeroContrato();

        const container = document.querySelector(
            '.MuiToolbar-root.MuiToolbar-regular.MuiToolbar-gutters'
        );

        const existingBtn = document.getElementById(buttonId);

        if (!numeroContrato || !container) {
            if (existingBtn) {
                existingBtn.remove();
            }

            return;
        }

        if (existingBtn) {
            return;
        }

        const btn = document.createElement('button');

        btn.id = buttonId;
        btn.style.cssText = buttonStyles;

        btn.innerHTML = `
            Contrato
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
        `;

        btn.onmouseover = () => {
            btn.style.backgroundColor = '#ffffff';
        };

        btn.onmouseout = () => {
            btn.style.backgroundColor = '#f2f2f2';
        };

        btn.addEventListener('click', () => {
            const valorCapturado = getNumeroContrato();

            if (!valorCapturado) {
                alert(
                    'Não foi possível ler o número do contrato no momento do clique.'
                );

                return;
            }

            const baseUrl =
                'https://erp.osirnet.com.br/authentication_contracts/contract_panel/';

            // Monta a URL do contrato com o identificador da automação.
            const url = new URL(
                baseUrl + encodeURIComponent(valorCapturado)
            );

            url.searchParams.set(autoClickParam, autoClickValue);

            // A automação só será habilitada nesta abertura.
            window.open(url.toString(), '_blank');
        });

        container.prepend(btn);
    }

    // =========================================================
    // ETAPA 3: VALIDAR A ORIGEM DA ABERTURA
    // =========================================================

    function isPaginaPainelContrato() {
        return window.location.pathname.includes(
            '/authentication_contracts/contract_panel/'
        );
    }

    function foiAbertoPeloBotao() {
        const params = new URLSearchParams(
            window.location.search
        );

        return (
            params.get(autoClickParam) === autoClickValue &&
            isPaginaPainelContrato()
        );
    }

    // =========================================================
    // ETAPA 4: CLICAR NA TERCEIRA COLUNA
    // SOMENTE QUANDO ABERTO PELO BOTÃO
    // =========================================================

    function iniciarAutomacaoPainel() {
        // Se não veio do botão Contrato, não executa nenhuma ação.
        if (!foiAbertoPeloBotao()) {
            return;
        }

        let concluido = false;

        const observer = new MutationObserver(() => {
            tentarClique();
        });

        function tentarClique() {
            if (concluido) {
                return;
            }

            // Confirma novamente o identificador antes de agir.
            if (!foiAbertoPeloBotao()) {
                observer.disconnect();
                return;
            }

            const linhas = document.querySelectorAll('tr.line');

            for (const linha of linhas) {
                const link = linha.querySelector(
                    'td:nth-child(3) a.aDataLink'
                );

                if (!link || !link.textContent.trim()) {
                    continue;
                }

                // Marca como concluído antes do clique para evitar
                // disparos duplicados durante a atualização da página.
                concluido = true;
                observer.disconnect();

                // Executa o comportamento original do link do ERP.
                link.click();

                return;
            }
        }

        // Observa o carregamento dinâmico da tabela.
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Tenta imediatamente caso a tabela já esteja carregada.
        tentarClique();
    }

    // =========================================================
    // ETAPA 5: INICIALIZAÇÃO
    // =========================================================

    // No painel do contrato, só executa a automação se houver
    // o parâmetro exclusivo adicionado pelo botão.
    iniciarAutomacaoPainel();

    // Na página original, acompanha as mudanças da interface
    // para manter o botão disponível quando houver um contrato.
    const pageObserver = new MutationObserver(() => {
        injectButton();
    });

    if (document.body) {
        pageObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    injectButton();
})();
