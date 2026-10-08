// ==UserScript==
// @name         Osir - Drawer de Autenticação no Contract Panel
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      2.3
// @description  Abre a autenticação em Drawer, preservando o comportamento nativo do ERP e o estado da página.
// @author       Lucashackd
// @match        https://erp.osirnet.com.br/authentication_contracts/contract_panel/*
// @license      MIT
// @homepageURL  https://github.com/Lucashackd/Scripts-Osirnet
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        AUTHENTICATION_PATH:
            '/authentication_contracts/get_authentication_informations/0/',

        DRAWER_PERCENT: 0.90,

        UI_RETRY_INTERVAL: 500,
        UI_MAX_RETRIES: 30,
    };

    /*
     * ============================================================
     * ESTADO
     * ============================================================
     */

    /*
     * URL da autenticação selecionada no último clique
     * em uma conexão.
     */
    let selectedAuthenticationUrl = '';

    /*
     * URL que está efetivamente carregada no iframe.
     *
     * Mantemos isso para saber se precisamos carregar uma
     * nova autenticação ou simplesmente reutilizar a página
     * já existente.
     */
    let iframeLoadedUrl = '';

    /*
     * Estado visual do Drawer.
     */
    let drawerOpen = false;

    /*
     * Controle de inicialização.
     */
    let uiRetryCount = 0;

    /*
     * Elementos da interface.
     */
    let triggerButton = null;
    let overlay = null;
    let drawer = null;
    let iframe = null;
    let loadingElement = null;

    /*
     * ============================================================
     * URL ATUAL
     * ============================================================
     */

    /**
     * Retorna o ID do contrato atual.
     *
     * Exemplo:
     *
     * /authentication_contracts/contract_panel/375236
     *
     * retorna:
     *
     * 375236
     */
    function getContractId() {
        const match = window.location.pathname.match(
            /\/authentication_contracts\/contract_panel\/(\d+)/
        );

        return match ? match[1] : null;
    }

    /**
     * Verifica se a URL atual possui explicitamente um '#'
     * no final.
     *
     * Exemplos:
     *
     * /contract_panel/375236
     * -> false
     *
     * /contract_panel/375236#
     * -> true
     *
     * /contract_panel/375236#qualquer-coisa
     * -> false
     *
     * A regra solicitada é especificamente o '#' final.
     */
    function hasTrailingHash() {
        return window.location.href.endsWith('#');
    }

    /**
     * Atualiza a visibilidade do botão conforme a URL atual.
     *
     * Esta função NÃO depende do ID do contrato.
     */
    function syncButtonVisibility() {
        if (!triggerButton) {
            return;
        }

        const shouldShow = hasTrailingHash();

        triggerButton.style.display =
            shouldShow ? 'block' : 'none';

        /*
         * Quando saímos da URL com '#',
         * a seleção anterior deixa de ser válida.
         */
        if (!shouldShow) {
            selectedAuthenticationUrl = '';
        }
    }

    /**
     * Verifica a URL após o navegador/ERP concluir o processamento
     * do clique no href="#".
     */
    function scheduleUrlSync() {
        /*
         * Primeiro ciclo.
         */
        window.setTimeout(
            syncButtonVisibility,
            0
        );

        /*
         * Segundo ciclo para cobrir manipulações posteriores
         * realizadas pelo próprio ERP.
         */
        window.setTimeout(
            syncButtonVisibility,
            50
        );

        /*
         * Terceiro ciclo para mudanças assíncronas.
         */
        window.setTimeout(
            syncButtonVisibility,
            200
        );
    }

    /*
     * ============================================================
     * IDENTIFICAÇÃO DA CONEXÃO
     * ============================================================
     */

    /**
     * Verifica se o link clicado é o link da coluna Conexão.
     *
     * Estrutura conhecida:
     *
     * td[0] = ID da autenticação
     * td[1] = tipo
     * td[2] = conexão
     */
    function isConnectionLink(link) {
        const row = link.closest('tr');

        if (!row || !row.classList.contains('line')) {
            return false;
        }

        const cell = link.closest('td');

        if (!cell) {
            return false;
        }

        /*
         * Terceira coluna.
         */
        if (cell.cellIndex !== 2) {
            return false;
        }

        const firstCell = row.cells[0];

        if (!firstCell) {
            return false;
        }

        const authenticationLink =
            firstCell.querySelector('a.aDataLink');

        if (!authenticationLink) {
            return false;
        }

        const authenticationId =
            authenticationLink.textContent.trim();

        return /^\d+$/.test(authenticationId);
    }

    /**
     * Obtém o ID da autenticação através da primeira coluna.
     */
    function getAuthenticationIdFromRow(row) {
        const firstCell = row?.cells?.[0];

        if (!firstCell) {
            return null;
        }

        const link =
            firstCell.querySelector('a.aDataLink');

        if (!link) {
            return null;
        }

        const value =
            link.textContent.trim();

        return /^\d+$/.test(value)
            ? value
            : null;
    }

    /**
     * Monta a URL da tela de autenticação.
     *
     * Exemplo:
     *
     * https://erp.osirnet.com.br/
     * authentication_contracts/
     * get_authentication_informations/
     * 0/
     * 375236/
     * 27302
     */
    function buildAuthenticationUrl(authenticationId) {
        const contractId =
            getContractId();

        if (!contractId || !authenticationId) {
            return null;
        }

        return (
            window.location.origin +
            CONFIG.AUTHENTICATION_PATH +
            contractId +
            '/' +
            authenticationId
        );
    }

    /*
     * ============================================================
     * ESTILIZAÇÃO
     * ============================================================
     */

    function injectStyles() {
        if (
            document.getElementById(
                'tm-osir-drawer-style'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            'tm-osir-drawer-style';

        style.textContent = `
            #tm-osir-auth-trigger {
                position: fixed;

                top: 14px;
                right: 18px;

                z-index: 2147483000;

                border: 0;
                border-radius: 5px;

                padding: 8px 14px;

                background: #3377ca;
                color: #fff;

                font-family:
                    Arial,
                    Helvetica,
                    sans-serif;

                font-size: 13px;
                font-weight: 600;

                cursor: pointer;

                box-shadow:
                    0 2px 8px rgba(0,0,0,.22);

                transition:
                    background .15s ease,
                    transform .15s ease;
            }

            #tm-osir-auth-trigger:hover {
                background: #2864ab;
                transform: translateY(-1px);
            }

            #tm-osir-auth-overlay {
                position: fixed;
                inset: 0;

                z-index: 2147482990;

                display: none;

                align-items: center;
                justify-content: center;

                background:
                    rgba(0,0,0,.42);
            }

            #tm-osir-auth-overlay.tm-visible {
                display: flex;
            }

            #tm-osir-auth-drawer {
                position: relative;

                width: 90vw;
                height: 90vh;

                min-width: 600px;
                min-height: 400px;

                background: #fff;

                border-radius: 6px;

                overflow: hidden;

                box-shadow:
                    0 18px 50px rgba(0,0,0,.35),
                    0 2px 8px rgba(0,0,0,.18);

                display: flex;
                flex-direction: column;
            }

            #tm-osir-auth-header {
                flex: 0 0 42px;

                display: flex;
                align-items: center;
                justify-content: space-between;

                padding:
                    0
                    12px
                    0
                    16px;

                background: #3377ca;
                color: #fff;

                font-family:
                    Arial,
                    Helvetica,
                    sans-serif;
            }

            #tm-osir-auth-title {
                font-size: 14px;
                font-weight: 600;

                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #tm-osir-auth-close {
                width: 30px;
                height: 30px;

                padding: 0;

                border: 0;
                border-radius: 4px;

                background: transparent;
                color: #fff;

                font-size: 22px;
                line-height: 30px;

                cursor: pointer;
            }

            #tm-osir-auth-close:hover {
                background:
                    rgba(255,255,255,.15);
            }

            #tm-osir-auth-content {
                position: relative;

                flex: 1 1 auto;

                min-height: 0;

                background: #fff;
            }

            #tm-osir-auth-iframe {
                display: block;

                width: 100%;
                height: 100%;

                border: 0;

                margin: 0;
                padding: 0;

                background: #fff;
            }

            #tm-osir-auth-loading {
                position: absolute;
                inset: 0;

                z-index: 5;

                display: none;

                align-items: center;
                justify-content: center;

                background: #fff;

                font-family:
                    Arial,
                    Helvetica,
                    sans-serif;

                font-size: 13px;
                color: #555;
            }
        `;

        document.head.appendChild(style);
    }

    /*
     * ============================================================
     * CRIAÇÃO DA INTERFACE
     * ============================================================
     */

    function createInterface() {
        if (
            document.getElementById(
                'tm-osir-auth-trigger'
            )
        ) {
            return;
        }

        injectStyles();

        /*
         * --------------------------------------------------------
         * BOTÃO
         * --------------------------------------------------------
         */

        triggerButton =
            document.createElement('button');

        triggerButton.id =
            'tm-osir-auth-trigger';

        triggerButton.type =
            'button';

        triggerButton.textContent =
            'Autenticação';

        triggerButton.title =
            'Abrir autenticação da conexão selecionada';

        /*
         * Começa invisível.
         *
         * syncButtonVisibility() decidirá quando mostrar.
         */
        triggerButton.style.display =
            'none';

        triggerButton.addEventListener(
            'click',
            function () {
                /*
                 * O botão não pode abrir nada sem uma conexão
                 * previamente selecionada.
                 */
                if (!selectedAuthenticationUrl) {
                    return;
                }

                openDrawer();
            }
        );

        document.body.appendChild(
            triggerButton
        );

        /*
         * --------------------------------------------------------
         * OVERLAY
         * --------------------------------------------------------
         */

        overlay =
            document.createElement('div');

        overlay.id =
            'tm-osir-auth-overlay';

        overlay.addEventListener(
            'click',
            function (event) {
                if (
                    event.target === overlay
                ) {
                    closeDrawer();
                }
            }
        );

        /*
         * --------------------------------------------------------
         * DRAWER
         * --------------------------------------------------------
         */

        drawer =
            document.createElement('div');

        drawer.id =
            'tm-osir-auth-drawer';

        drawer.addEventListener(
            'click',
            function (event) {
                event.stopPropagation();
            }
        );

        /*
         * --------------------------------------------------------
         * HEADER
         * --------------------------------------------------------
         */

        const header =
            document.createElement('div');

        header.id =
            'tm-osir-auth-header';

        const title =
            document.createElement('div');

        title.id =
            'tm-osir-auth-title';

        title.textContent =
            'Autenticação';

        const closeButton =
            document.createElement('button');

        closeButton.id =
            'tm-osir-auth-close';

        closeButton.type =
            'button';

        closeButton.innerHTML =
            '&times;';

        closeButton.title =
            'Fechar';

        closeButton.addEventListener(
            'click',
            closeDrawer
        );

        header.appendChild(title);
        header.appendChild(closeButton);

        /*
         * --------------------------------------------------------
         * CONTEÚDO
         * --------------------------------------------------------
         */

        const content =
            document.createElement('div');

        content.id =
            'tm-osir-auth-content';

        loadingElement =
            document.createElement('div');

        loadingElement.id =
            'tm-osir-auth-loading';

        loadingElement.textContent =
            'Carregando autenticação...';

        iframe =
            document.createElement('iframe');

        iframe.id =
            'tm-osir-auth-iframe';

        iframe.title =
            'Tela de autenticação';

        /*
         * O iframe permanece vivo depois do primeiro carregamento.
         */
        iframe.addEventListener(
            'load',
            function () {
                /*
                 * Guarda a URL que realmente terminou
                 * de carregar.
                 */
                iframeLoadedUrl =
                    iframe.dataset.tmLoadedUrl ||
                    iframe.src ||
                    '';

                if (loadingElement) {
                    loadingElement.style.display =
                        'none';
                }

                adjustIframeLayout();

                /*
                 * Alguns componentes antigos do ERP realizam
                 * cálculos após o carregamento.
                 */
                [100, 500, 1000, 2000]
                    .forEach(
                        function (delay) {
                            window.setTimeout(
                                adjustIframeLayout,
                                delay
                            );
                        }
                    );
            }
        );

        content.appendChild(
            iframe
        );

        content.appendChild(
            loadingElement
        );

        drawer.appendChild(
            header
        );

        drawer.appendChild(
            content
        );

        overlay.appendChild(
            drawer
        );

        /*
         * IMPORTANTE:
         *
         * Nunca removemos o overlay nem o iframe.
         *
         * Fechar significa apenas ocultar o overlay.
         */
        document.body.appendChild(
            overlay
        );

        /*
         * --------------------------------------------------------
         * ESC
         * --------------------------------------------------------
         */

        window.addEventListener(
            'keydown',
            function (event) {
                if (
                    event.key === 'Escape' &&
                    drawerOpen
                ) {
                    closeDrawer();
                }
            }
        );

        /*
         * --------------------------------------------------------
         * RESIZE
         * --------------------------------------------------------
         */

        window.addEventListener(
            'resize',
            function () {
                if (drawerOpen) {
                    resizeDrawer();
                }
            }
        );

        resizeDrawer();

        /*
         * Primeira avaliação da URL.
         */
        syncButtonVisibility();
    }

    /*
     * ============================================================
     * DIMENSIONAMENTO DO DRAWER
     * ============================================================
     */

    function resizeDrawer() {
        if (!drawer) {
            return;
        }

        const width =
            Math.min(
                Math.floor(
                    window.innerWidth *
                    CONFIG.DRAWER_PERCENT
                ),
                window.innerWidth - 30
            );

        const height =
            Math.min(
                Math.floor(
                    window.innerHeight *
                    CONFIG.DRAWER_PERCENT
                ),
                window.innerHeight - 30
            );

        drawer.style.width =
            Math.max(
                600,
                width
            ) + 'px';

        drawer.style.height =
            Math.max(
                400,
                height
            ) + 'px';
    }

    /*
     * ============================================================
     * ABRIR DRAWER
     * ============================================================
     */

    function openDrawer() {
        if (
            !selectedAuthenticationUrl ||
            !overlay ||
            !iframe
        ) {
            return;
        }

        drawerOpen = true;

        resizeDrawer();

        overlay.classList.add(
            'tm-visible'
        );

        /*
         * --------------------------------------------------------
         * AUTENTICAÇÃO JÁ CARREGADA
         * --------------------------------------------------------
         *
         * Se a URL atualmente selecionada já está no iframe,
         * simplesmente mostramos o estado existente.
         */
        if (
            iframeLoadedUrl ===
            selectedAuthenticationUrl
        ) {
            adjustIframeLayout();
            return;
        }

        /*
         * --------------------------------------------------------
         * NOVA AUTENTICAÇÃO
         * --------------------------------------------------------
         *
         * Só aqui ocorre uma nova navegação do iframe.
         *
         * Fechar o Drawer não chega a este ponto novamente
         * enquanto a autenticação selecionada não mudar.
         */
        if (loadingElement) {
            loadingElement.style.display =
                'flex';
        }

        iframe.dataset.tmLoadedUrl =
            selectedAuthenticationUrl;

        iframe.src =
            selectedAuthenticationUrl;
    }

    /*
     * ============================================================
     * FECHAR DRAWER
     * ============================================================
     */

    function closeDrawer() {
        drawerOpen = false;

        /*
         * NÃO fazemos:
         *
         * iframe.src = ''
         * iframe.remove()
         * iframe.reload()
         *
         * O documento permanece exatamente no estado atual.
         */
        if (overlay) {
            overlay.classList.remove(
                'tm-visible'
            );
        }
    }

    /*
     * ============================================================
     * AJUSTES DO IFRAME
     * ============================================================
     */

    function adjustIframeLayout() {
        if (!iframe) {
            return;
        }

        try {
            const frameWindow =
                iframe.contentWindow;

            const frameDocument =
                iframe.contentDocument ||
                frameWindow.document;

            /*
             * Dispara resize para os componentes que dependem
             * das dimensões da janela.
             */
            frameWindow.dispatchEvent(
                new Event('resize')
            );

            /*
             * DataTables existentes são apenas ajustadas.
             *
             * Não recriamos as tabelas e não alteramos seus dados.
             */
            if (
                frameWindow.jQuery &&
                frameWindow.jQuery.fn &&
                frameWindow.jQuery.fn.dataTable
            ) {
                const $ =
                    frameWindow.jQuery;

                frameDocument
                    .querySelectorAll('table')
                    .forEach(
                        function (table) {
                            try {
                                if (
                                    $.fn.dataTable
                                        .isDataTable(
                                            table
                                        )
                                ) {
                                    $(table)
                                        .dataTable()
                                        .fnAdjustColumnSizing();
                                }
                            } catch (_) {
                                /*
                                 * Algumas tabelas podem estar
                                 * em processo de inicialização.
                                 */
                            }
                        }
                    );
            }
        } catch (_) {
            /*
             * Não interromper o funcionamento do ERP caso algum
             * componente interno não aceite o resize.
             */
        }
    }

    /*
     * ============================================================
     * CLIQUE NA CONEXÃO
     * ============================================================
     */

    function handleConnectionClick(event) {
        const link =
            event.target.closest(
                'a.aDataLink'
            );

        if (!link) {
            return;
        }

        if (
            !isConnectionLink(link)
        ) {
            return;
        }

        const row =
            link.closest('tr');

        const authenticationId =
            getAuthenticationIdFromRow(
                row
            );

        if (!authenticationId) {
            return;
        }

        const url =
            buildAuthenticationUrl(
                authenticationId
            );

        if (!url) {
            return;
        }

        /*
         * Apenas registramos a autenticação.
         *
         * NÃO:
         *
         * - abrimos o Drawer;
         * - usamos preventDefault();
         * - usamos stopPropagation();
         * - usamos stopImmediatePropagation().
         *
         * O ERP continua executando o comportamento natural
         * do <a href="#">.
         */
        selectedAuthenticationUrl =
            url;

        /*
         * O botão deve aparecer somente depois que o ERP
         * efetivamente estiver na URL terminada em '#'.
         */
        scheduleUrlSync();
    }

    /*
     * ============================================================
     * EVENTOS DE NAVEGAÇÃO
     * ============================================================
     */

    function installNavigationListeners() {
        /*
         * Caso o navegador dispare hashchange.
         */
        window.addEventListener(
            'hashchange',
            function () {
                syncButtonVisibility();
            }
        );

        /*
         * Caso alguma navegação use history API.
         */
        window.addEventListener(
            'popstate',
            function () {
                syncButtonVisibility();
            }
        );
    }

    /*
     * ============================================================
     * CLIQUE
     * ============================================================
     */

    function installConnectionListener() {
        /*
         * Capture=true apenas permite observar o clique.
         *
         * Como não cancelamos o evento, o ERP continua
         * executando seus próprios listeners normalmente.
         */
        document.addEventListener(
            'click',
            handleConnectionClick,
            true
        );
    }

    /*
     * ============================================================
     * GARANTIA DA INTERFACE
     * ============================================================
     */

    function ensureInterface() {
        if (
            document.getElementById(
                'tm-osir-auth-trigger'
            )
        ) {
            syncButtonVisibility();

            return true;
        }

        createInterface();

        return Boolean(
            document.getElementById(
                'tm-osir-auth-trigger'
            )
        );
    }

    /*
     * ============================================================
     * BOOT
     * ============================================================
     */

    function boot() {
        if (!document.body) {
            window.setTimeout(
                boot,
                CONFIG.UI_RETRY_INTERVAL
            );

            return;
        }

        createInterface();

        installConnectionListener();
        installNavigationListeners();

        /*
         * Garante que o estado da URL continue refletido
         * na interface caso o ERP altere a tela dinamicamente.
         */
        const retry =
            window.setInterval(
                function () {
                    uiRetryCount++;

                    syncButtonVisibility();

                    if (
                        ensureInterface() ||
                        uiRetryCount >=
                            CONFIG.UI_MAX_RETRIES
                    ) {
                        window.clearInterval(
                            retry
                        );
                    }
                },
                CONFIG.UI_RETRY_INTERVAL
            );
    }

    /*
     * ============================================================
     * INICIALIZAÇÃO
     * ============================================================
     */

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            boot,
            { once: true }
        );
    } else {
        boot();
    }

})();
