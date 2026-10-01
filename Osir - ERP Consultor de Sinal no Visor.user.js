// ==UserScript==
// @name         Osir - ERP Consultor de Sinal no Visor
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      2.7
// @description  Consulta a potência RX no Visor OSIR e permite copiar manualmente o resultado
// @author       Lucashackd
// @match        https://erp.osirnet.com.br/ui/*/legacy/operations/**
// @match        *://*.osirnet.com.br/*
// @match        https://visor.osir.net.br/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @license      MIT
// @homepageURL  https://github.com/Lucashackd/Scripts-Osirnet
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20ERP%20Consultor%20de%20Sinal%20no%20Visor.user.js
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20ERP%20Consultor%20de%20Sinal%20no%20Visor.user.js
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// ==/UserScript==

(function () {
    'use strict';


    // =====================================================================
    // CONFIGURAÇÕES
    // =====================================================================

    const REQUEST_KEY =
        'osir_visor_rx_request_v26';

    const RESULT_KEY =
        'osir_visor_rx_result_v26';

    const NOTICE_DURATION =
        15000;


    // =====================================================================
    // MAPA DE OLTs
    // =====================================================================

    const MAPA_OLT = {
        'PLTDU': 'OLT DU',
        'RGPQM': 'OLT RG_PQM',
        'RG_CE': 'OLT RG_CE_1',
        'STL_CE3_R': 'OLT CE3_R',
        'STL_CE4_R': 'OLT CE4_R',
        'CSS1': 'OLT CSS_1',
        'CSS2': 'OLT CSS_2',
        'RGJUN1': 'OLT RG_JUN_1',
        'RGQNT': 'RG_QNT',
        'SVPGAB': 'OLT GAB',
        'SVPLDA': 'OLT LDA',
        'ROS': 'OLT ROS',
        'GAR': 'OLT GAR',
        'ZN': 'OLT ZN',
        'FGT': 'OLT FGT',
        'GER': 'OLT GER',
        'VCII': 'OLT VCII',
        'RGPVN': 'OLT PVN',
        'STL_TAB': 'OLT STLTAB',
        'RGCBA': 'OLT CBA',
        'FENADOCE CLIENTES': 'OLT Fenadoce'
    };


    // =====================================================================
    // TRADUÇÃO DA OLT
    // =====================================================================

    function traduzirAccessPoint(rawText) {
        if (!rawText) {
            return '';
        }

        let cleaned =
            rawText.trim();


        // =================================================================
        // REMOVE "FIBRA" DO INÍCIO
        //
        // Ex:
        // Fibra CSS1 Dedicados
        // -> CSS1 Dedicados
        // =================================================================

        cleaned =
            cleaned.replace(
                /^Fibra\s+/i,
                ''
            );


        // =================================================================
        // REMOVE SUFIXOS AUXILIARES
        //
        // Os sufixos podem eventualmente aparecer em ordens diferentes.
        //
        // Exemplos aceitos:
        //
        // CSS1 Dedicados
        //
        // CSS1 Dedicados Slot 1 Porta 2
        //
        // CSS1 Slot 1 Porta 2 Dedicados
        //
        // Todos resultam em:
        //
        // CSS1
        // =================================================================

        let valorAnterior;


        do {

            valorAnterior =
                cleaned;


            // -------------------------------------------------------------
            // REMOVE "DEDICADOS" DO FINAL
            // -------------------------------------------------------------

            cleaned =
                cleaned.replace(
                    /\s+Dedicados$/i,
                    ''
                );


            // -------------------------------------------------------------
            // REMOVE "SLOT XX PORTA XX" DO FINAL
            // -------------------------------------------------------------

            cleaned =
                cleaned.replace(
                    /\s+Slot\s+\d+\s+Porta\s+\d+$/i,
                    ''
                );


            cleaned =
                cleaned.trim();


        }
        while (
            cleaned !==
            valorAnterior
        );


        // =================================================================
        // MAPEAMENTOS ESPECIAIS
        // =================================================================

        if (
            MAPA_OLT[cleaned]
        ) {

            return MAPA_OLT[
                cleaned
            ];
        }


        // =================================================================
        // REGRA PADRÃO
        // =================================================================

        if (
            !cleaned.startsWith('OLT ') &&
            !cleaned.startsWith('OTL ')
        ) {

            return `OLT ${cleaned}`;
        }


        return cleaned;
    }


    // =====================================================================
    // INPUT REACT
    // =====================================================================

    function setNativeInputValue(
        input,
        value
    ) {
        const nativeSetter =
            Object
                .getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    'value'
                )
                .set;


        nativeSetter.call(
            input,
            value
        );


        input.dispatchEvent(
            new Event(
                'input',
                {
                    bubbles: true
                }
            )
        );


        input.dispatchEvent(
            new Event(
                'change',
                {
                    bubbles: true
                }
            )
        );
    }


    // =====================================================================
    // VISOR
    // =====================================================================

    if (
        window.location.hostname ===
        'visor.osir.net.br'
    ) {

        console.log(
            '[RX AUTOMATION 2.7] Visor detectado.'
        );


        const sleep =
            (ms) =>
                new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            ms
                        )
                );


        function normalizarTexto(texto) {
            return String(
                texto || ''
            )
                .replace(
                    /\s+/g,
                    ' '
                )
                .trim()
                .toUpperCase();
        }


        async function esperarElemento(
            getElement,
            timeout = 5000,
            intervalo = 100
        ) {
            const inicio =
                Date.now();


            while (
                Date.now() - inicio <
                timeout
            ) {

                const elemento =
                    getElement();


                if (elemento) {
                    return elemento;
                }


                await sleep(
                    intervalo
                );
            }


            return null;
        }


        // =================================================================
        // RESULTADOS
        // =================================================================

        function enviarResultado(
            rx,
            oltDiferente
        ) {
            const resultado = {
                tipo:
                    'sucesso',

                rx:
                    rx,

                oltDiferente:
                    Boolean(
                        oltDiferente
                    ),

                timestamp:
                    Date.now()
            };


            GM_setValue(
                RESULT_KEY,
                JSON.stringify(
                    resultado
                )
            );
        }


        function enviarErro(
            mensagem
        ) {
            const resultado = {
                tipo:
                    'erro',

                mensagem:
                    `ERRO: ${mensagem}`,

                timestamp:
                    Date.now()
            };


            GM_setValue(
                RESULT_KEY,
                JSON.stringify(
                    resultado
                )
            );
        }


        // =================================================================
        // MODO OLT / CIDADE
        // =================================================================

        function encontrarContainerModoConsulta() {
            return document.querySelector(
                'div.relative.grid.grid-cols-2'
            );
        }


        function encontrarBotaoModoOlt() {
            const container =
                encontrarContainerModoConsulta();


            if (!container) {
                return null;
            }


            const botoes =
                Array.from(
                    container.querySelectorAll(
                        'button[type="button"]'
                    )
                );


            return (
                botoes.find(
                    btn =>
                        normalizarTexto(
                            btn.textContent
                        ) ===
                        'OLT'
                )
                ||
                botoes[1]
                ||
                null
            );
        }


        function encontrarBotaoModoCidade() {
            const container =
                encontrarContainerModoConsulta();


            if (!container) {
                return null;
            }


            const botoes =
                Array.from(
                    container.querySelectorAll(
                        'button[type="button"]'
                    )
                );


            return (
                botoes.find(
                    btn =>
                        normalizarTexto(
                            btn.textContent
                        ) ===
                        'CIDADE'
                )
                ||
                botoes[0]
                ||
                null
            );
        }


        // =================================================================
        // BOTÃO CONSULTAR
        // =================================================================

        function encontrarBotaoConsultar() {
            const botoes =
                Array.from(
                    document.querySelectorAll(
                        'button[type="submit"]'
                    )
                );


            return (
                botoes.find(
                    btn =>
                        btn.offsetParent !==
                        null
                )
                ||
                botoes[0]
                ||
                null
            );
        }


        // =================================================================
        // DETECÇÃO DOS AVISOS
        // =================================================================

        function detectarAvisosOntNaoEncontrada() {

            let avisoOlt =
                null;

            let avisoCidade =
                null;


            const divs =
                Array.from(
                    document.querySelectorAll(
                        'div'
                    )
                );


            for (
                const div of divs
            ) {

                const texto =
                    normalizarTexto(
                        div.textContent
                    );


                if (
                    texto.includes(
                        'ONT NÃO ENCONTRADA EM NENHUMA OLT'
                    )
                ) {
                    avisoCidade =
                        div;
                }


                if (
                    texto.includes(
                        'ONT NÃO ENCONTRADA NESTA OLT'
                    )
                ) {
                    avisoOlt =
                        div;
                }
            }


            return {
                olt:
                    avisoOlt,

                cidade:
                    avisoCidade
            };
        }


        // =================================================================
        // SELETOR OLT
        // =================================================================

        function encontrarSeletorOlt() {
            const candidatos =
                Array.from(
                    document.querySelectorAll(
                        'div.fade-swap > div.relative > button[type="button"]'
                    )
                );


            return (
                candidatos.find(
                    btn => {

                        const texto =
                            normalizarTexto(
                                btn.textContent
                            );


                        return (
                            texto ===
                                'SELECIONE UMA OLT'
                            ||
                            texto.startsWith(
                                'OLT '
                            )
                            ||
                            texto.startsWith(
                                'OTL '
                            )
                            ||
                            texto ===
                                'RG_QNT'
                        );
                    }
                )
                ||
                null
            );
        }


        // =================================================================
        // SELECIONA OLT
        // =================================================================

        async function selecionarOlt(
            olt
        ) {
            const oltNormalizada =
                normalizarTexto(
                    olt
                );


            if (!oltNormalizada) {
                throw new Error(
                    'OLT recebida está vazia'
                );
            }


            const seletor =
                await esperarElemento(
                    encontrarSeletorOlt,
                    5000
                );


            if (!seletor) {
                throw new Error(
                    'Seletor de OLT não encontrado'
                );
            }


            if (
                normalizarTexto(
                    seletor.textContent
                ) ===
                oltNormalizada
            ) {
                return;
            }


            seletor.click();


            const wrapper =
                seletor.parentElement;


            const campoBusca =
                await esperarElemento(
                    () =>
                        wrapper
                            ?.querySelector(
                                'input[placeholder="Buscar OLT..."]'
                            ),
                    3000
                );


            if (!campoBusca) {
                throw new Error(
                    'Campo de busca da OLT não encontrado'
                );
            }


            campoBusca.focus();


            setNativeInputValue(
                campoBusca,
                olt
            );


            await sleep(
                250
            );


            for (
                const eventType of
                [
                    'keydown',
                    'keyup'
                ]
            ) {
                campoBusca.dispatchEvent(
                    new KeyboardEvent(
                        eventType,
                        {
                            key:
                                'ArrowDown',

                            code:
                                'ArrowDown',

                            keyCode:
                                40,

                            which:
                                40,

                            bubbles:
                                true
                        }
                    )
                );
            }


            const opcao =
                await esperarElemento(
                    () => {

                        const opcoes =
                            Array.from(
                                wrapper
                                    ?.querySelectorAll(
                                        'button[data-index]'
                                    )
                                ||
                                []
                            );


                        const exata =
                            opcoes.find(
                                btn =>
                                    normalizarTexto(
                                        btn.textContent
                                    ) ===
                                    oltNormalizada
                            );


                        if (exata) {
                            return exata;
                        }


                        if (
                            opcoes.length ===
                            1
                        ) {
                            return opcoes[0];
                        }


                        return null;
                    },
                    3000,
                    100
                );


            if (!opcao) {
                throw new Error(
                    `OLT não encontrada na lista: ${olt}`
                );
            }


            opcao.click();


            const selecionada =
                await esperarElemento(
                    () => {

                        const seletorAtual =
                            encontrarSeletorOlt();


                        if (
                            seletorAtual &&
                            normalizarTexto(
                                seletorAtual.textContent
                            ) ===
                            oltNormalizada
                        ) {
                            return seletorAtual;
                        }


                        return null;
                    },
                    3000,
                    100
                );


            if (!selecionada) {
                throw new Error(
                    `Falha ao confirmar a seleção da OLT: ${olt}`
                );
            }
        }


        // =================================================================
        // SERIAL
        // =================================================================

        function encontrarInputSerial() {
            const inputs =
                Array
                    .from(
                        document.querySelectorAll(
                            'input'
                        )
                    )
                    .filter(
                        input =>
                            input.getAttribute(
                                'placeholder'
                            ) !==
                            'Buscar OLT...'
                    );


            const identificado =
                inputs.find(
                    input => {

                        const descricao =
                            normalizarTexto(
                                [
                                    input.id,
                                    input.name,
                                    input.placeholder,
                                    input.getAttribute(
                                        'aria-label'
                                    )
                                ]
                                    .filter(
                                        Boolean
                                    )
                                    .join(
                                        ' '
                                    )
                            );


                        return descricao.includes(
                            'SERIAL'
                        );
                    }
                );


            return (
                identificado
                ||
                inputs.find(
                    input =>
                        input.offsetParent !==
                        null
                )
                ||
                inputs[0]
                ||
                null
            );
        }


        // =================================================================
        // RECEBE REQUISIÇÃO
        // =================================================================

        GM_addValueChangeListener(
            REQUEST_KEY,

            async function (
                name,
                oldValue,
                rawData,
                remote
            ) {

                if (
                    !remote ||
                    !rawData
                ) {
                    return;
                }


                let data;


                try {
                    data =
                        typeof rawData ===
                        'string'
                            ? JSON.parse(
                                rawData
                            )
                            : rawData;
                }
                catch (error) {
                    console.error(
                        '[RX AUTOMATION] Requisição inválida:',
                        error
                    );

                    return;
                }


                const {
                    serial,
                    olt
                } = data;


                try {

                    const oltButton =
                        await esperarElemento(
                            encontrarBotaoModoOlt,
                            3000
                        );


                    if (!oltButton) {
                        throw new Error(
                            'Botão do modo OLT não encontrado'
                        );
                    }


                    oltButton.click();


                    await sleep(
                        300
                    );


                    await selecionarOlt(
                        olt
                    );


                    const serialInput =
                        await esperarElemento(
                            encontrarInputSerial,
                            3000
                        );


                    if (!serialInput) {
                        throw new Error(
                            'Input do serial não encontrado'
                        );
                    }


                    serialInput.focus();


                    setNativeInputValue(
                        serialInput,
                        serial
                    );


                    await sleep(
                        300
                    );


                    const submitBtn =
                        await esperarElemento(
                            encontrarBotaoConsultar,
                            3000
                        );


                    if (!submitBtn) {
                        throw new Error(
                            'Botão Consultar não encontrado'
                        );
                    }


                    submitBtn.disabled =
                        false;


                    submitBtn.click();


                    aguardarResultado(
                        serial,
                        false
                    );

                }
                catch (error) {

                    console.error(
                        '[RX AUTOMATION] Erro:',
                        error
                    );


                    enviarErro(
                        error.message ||
                        'Falha ao preencher Visor'
                    );
                }
            }
        );


        // =================================================================
        // FALLBACK CIDADE
        // =================================================================

        async function tentarConsultaPorCidade(
            targetSerial,
            motivo
        ) {

            console.warn(
                '[RX AUTOMATION] Tentando consulta por Cidade:',
                motivo
            );


            const cidadeButton =
                await esperarElemento(
                    encontrarBotaoModoCidade,
                    3000
                );


            if (!cidadeButton) {
                enviarErro(
                    'Timeout (não carregou)'
                );

                return;
            }


            cidadeButton.click();


            await sleep(
                500
            );


            const submitBtn =
                await esperarElemento(
                    encontrarBotaoConsultar,
                    3000
                );


            if (!submitBtn) {
                enviarErro(
                    'Timeout (não carregou)'
                );

                return;
            }


            submitBtn.disabled =
                false;


            submitBtn.click();


            aguardarResultado(
                targetSerial,
                true
            );
        }


        // =================================================================
        // AGUARDA RESULTADO
        // =================================================================

        function aguardarResultado(
            targetSerial,
            consultaPorCidade = false
        ) {

            let tentativas =
                0;


            const maxTentativas =
                40;


            const checkInterval =
                setInterval(
                    () => {

                        tentativas++;


                        try {

                            const avisos =
                                detectarAvisosOntNaoEncontrada();


                            if (
                                consultaPorCidade &&
                                avisos.cidade
                            ) {

                                clearInterval(
                                    checkInterval
                                );


                                enviarErro(
                                    'ONT não encontrada'
                                );


                                return;
                            }


                            if (
                                !consultaPorCidade &&
                                avisos.olt
                            ) {

                                clearInterval(
                                    checkInterval
                                );


                                tentarConsultaPorCidade(
                                    targetSerial,
                                    'ONT não encontrada nesta OLT'
                                )
                                    .catch(
                                        error => {

                                            console.error(
                                                error
                                            );


                                            enviarErro(
                                                'Timeout (não carregou)'
                                            );
                                        }
                                    );


                                return;
                            }


                            const rxLabel =
                                Array
                                    .from(
                                        document.querySelectorAll(
                                            'span'
                                        )
                                    )
                                    .find(
                                        span =>
                                            normalizarTexto(
                                                span.textContent
                                            ) ===
                                            'POTÊNCIA RX'
                                    );


                            if (rxLabel) {

                                const resultCard =
                                    rxLabel.closest(
                                        '.result-pop'
                                    )
                                    ||
                                    rxLabel.closest(
                                        'main'
                                    )
                                    ||
                                    document.body;


                                const cardText =
                                    normalizarTexto(
                                        resultCard.textContent
                                    );


                                if (
                                    cardText.includes(
                                        normalizarTexto(
                                            targetSerial
                                        )
                                    )
                                ) {

                                    const rxContainer =
                                        rxLabel
                                            .parentElement
                                            ?.querySelector(
                                                '.text-2xl'
                                            );


                                    if (rxContainer) {

                                        clearInterval(
                                            checkInterval
                                        );


                                        setTimeout(
                                            () => {

                                                const spanAtualizado =
                                                    Array
                                                        .from(
                                                            document.querySelectorAll(
                                                                'span'
                                                            )
                                                        )
                                                        .find(
                                                            span =>
                                                                normalizarTexto(
                                                                    span.textContent
                                                                ) ===
                                                                'POTÊNCIA RX'
                                                        );


                                                const containerAtualizado =
                                                    spanAtualizado
                                                        ?.parentElement
                                                        ?.querySelector(
                                                            '.text-2xl'
                                                        );


                                                const rxValue =
                                                    containerAtualizado
                                                        ?.textContent
                                                        ?.trim()
                                                    ||
                                                    '';


                                                if (!rxValue) {

                                                    enviarErro(
                                                        'Valor RX em branco'
                                                    );

                                                    return;
                                                }


                                                enviarResultado(
                                                    rxValue,
                                                    consultaPorCidade
                                                );

                                            },
                                            1000
                                        );


                                        return;
                                    }
                                }
                            }

                        }
                        catch (error) {

                            clearInterval(
                                checkInterval
                            );


                            console.error(
                                error
                            );


                            enviarErro(
                                'Falha na leitura'
                            );


                            return;
                        }


                        if (
                            tentativas >=
                            maxTentativas
                        ) {

                            clearInterval(
                                checkInterval
                            );


                            if (
                                !consultaPorCidade
                            ) {

                                tentarConsultaPorCidade(
                                    targetSerial,
                                    'Timeout da consulta por OLT'
                                )
                                    .catch(
                                        error => {

                                            console.error(
                                                error
                                            );


                                            enviarErro(
                                                'Timeout (não carregou)'
                                            );
                                        }
                                    );


                                return;
                            }


                            enviarErro(
                                'Timeout (não carregou)'
                            );
                        }

                    },
                    500
                );
        }


        return;
    }


    // =====================================================================
    // ERP
    // =====================================================================

    const BUTTON_ID =
        'tm-visor-rx-button-v26';


    const COPY_BUTTON_ID =
        'tm-visor-rx-copy-button-v26';


    const EYE_ICON_SVG = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>
    `;


    const COPY_ICON_SVG = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.3"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <rect
                width="14"
                height="14"
                x="8"
                y="8"
                rx="2"
                ry="2"
            />
            <path
                d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
            />
        </svg>
    `;


    // =====================================================================
    // CONTROLE DOS AVISOS
    // =====================================================================

    function cancelarTimerAviso(
        btn
    ) {

        if (
            btn._rxNoticeTimer
        ) {

            clearTimeout(
                btn._rxNoticeTimer
            );


            btn._rxNoticeTimer =
                null;
        }
    }


    function limparEstadoAviso(
        btn
    ) {

        cancelarTimerAviso(
            btn
        );


        delete btn.dataset.noticeActive;
        delete btn.dataset.noticeType;
        delete btn.dataset.differentOlt;
    }


    function iniciarTimerAviso(
        btn
    ) {

        cancelarTimerAviso(
            btn
        );


        btn._rxNoticeTimer =
            setTimeout(
                () => {

                    if (
                        !btn.isConnected ||
                        btn.dataset.loading
                    ) {
                        return;
                    }


                    if (
                        btn.dataset.noticeActive ===
                        'true'
                    ) {

                        setButtonDefaultState(
                            btn
                        );
                    }

                },
                NOTICE_DURATION
            );
    }


    // =====================================================================
    // ESTADOS
    // =====================================================================

    function setButtonDefaultState(
        btn
    ) {

        limparEstadoAviso(
            btn
        );


        delete btn.dataset.loading;


        btn.innerHTML =
            EYE_ICON_SVG;


        btn.style.backgroundColor =
            '#22c55e';


        btn.style.color =
            '#000000';


        btn.title =
            'Consultar Potência RX no Visor OSIR';
    }


    function setButtonDifferentOltState(
        btn
    ) {

        limparEstadoAviso(
            btn
        );


        delete btn.dataset.loading;


        btn.dataset.noticeActive =
            'true';


        btn.dataset.noticeType =
            'different-olt';


        btn.dataset.differentOlt =
            'true';


        btn.innerHTML =
            '<span>Encontrado em OLT diferente</span>';


        btn.style.backgroundColor =
            '#f59e0b';


        btn.style.color =
            '#111827';


        btn.title =
            'A ONT foi encontrada em uma OLT diferente.';


        iniciarTimerAviso(
            btn
        );
    }


    function setButtonErrorState(
        btn,
        mensagem
    ) {

        limparEstadoAviso(
            btn
        );


        delete btn.dataset.loading;


        btn.dataset.noticeActive =
            'true';


        btn.dataset.noticeType =
            'error';


        btn.innerHTML =
            `<span>${mensagem}</span>`;


        btn.style.backgroundColor =
            '#ef4444';


        btn.style.color =
            '#ffffff';


        btn.title =
            mensagem;


        iniciarTimerAviso(
            btn
        );
    }


    // =====================================================================
    // CÓPIA MANUAL
    // =====================================================================

    async function copiarTextoManual(
        texto
    ) {

        if (!texto) {
            return false;
        }


        if (
            navigator.clipboard &&
            typeof navigator.clipboard.writeText ===
            'function'
        ) {

            await navigator.clipboard.writeText(
                texto
            );


            return true;
        }


        const textarea =
            document.createElement(
                'textarea'
            );


        textarea.value =
            texto;


        textarea.style.position =
            'fixed';


        textarea.style.opacity =
            '0';


        textarea.style.pointerEvents =
            'none';


        document.body.appendChild(
            textarea
        );


        textarea.focus();

        textarea.select();


        const sucesso =
            document.execCommand(
                'copy'
            );


        textarea.remove();


        return sucesso;
    }


    // =====================================================================
    // BOTÃO COPIAR
    // =====================================================================

    function removerBotaoCopiar() {

        const btn =
            document.getElementById(
                COPY_BUTTON_ID
            );


        if (btn) {
            btn.remove();
        }
    }


    function criarOuAtualizarBotaoCopiar(
        searchBtn,
        rxValue
    ) {

        let copyBtn =
            document.getElementById(
                COPY_BUTTON_ID
            );


        if (!copyBtn) {

            copyBtn =
                document.createElement(
                    'button'
                );


            copyBtn.id =
                COPY_BUTTON_ID;


            copyBtn.type =
                'button';


            copyBtn.style.cssText = `
                margin-left: 8px;
                padding: 5px 12px;
                border: 1px solid #1d4ed8;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-family: inherit;
                height: 40px;
                align-self: center;
                transition: all 0.2s ease-in-out;
                white-space: nowrap;
                flex-shrink: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                box-shadow: 0 2px 4px rgba(0,0,0,.15);
                background-color: #3b82f6;
                color: #ffffff;
            `;


            searchBtn.insertAdjacentElement(
                'afterend',
                copyBtn
            );
        }


        copyBtn.dataset.rxValue =
            rxValue;


        copyBtn.title =
            'Copiar potência RX';


        copyBtn.innerHTML =
            `${COPY_ICON_SVG}<span>${rxValue}</span>`;


        copyBtn.onclick =
            async () => {

                const valor =
                    copyBtn.dataset.rxValue
                    ||
                    '';


                if (!valor) {
                    return;
                }


                try {

                    await copiarTextoManual(
                        valor
                    );


                    copyBtn.innerHTML =
                        `${COPY_ICON_SVG}<span>Copiado!</span>`;


                    setTimeout(
                        () => {

                            if (
                                copyBtn.isConnected
                            ) {

                                copyBtn.innerHTML =
                                    `${COPY_ICON_SVG}<span>${valor}</span>`;
                            }

                        },
                        1200
                    );

                }
                catch (error) {

                    console.error(
                        '[RX AUTOMATION] Falha ao copiar:',
                        error
                    );


                    copyBtn.innerHTML =
                        `${COPY_ICON_SVG}<span>Erro ao copiar</span>`;


                    setTimeout(
                        () => {

                            if (
                                copyBtn.isConnected
                            ) {

                                copyBtn.innerHTML =
                                    `${COPY_ICON_SVG}<span>${valor}</span>`;
                            }

                        },
                        1500
                    );
                }
            };
    }


    // =====================================================================
    // INJETA BOTÃO
    // =====================================================================

    function injetarBotaoSeNecessario() {

        const inputEl =
            document.querySelector(
                '#equipmentSerialNumber'
            );


        if (!inputEl) {
            return;
        }


        if (
            document.getElementById(
                BUTTON_ID
            )
        ) {
            return;
        }


        const container =
            inputEl.closest(
                '.MuiFormControl-root'
            );


        if (
            !container ||
            !container.parentNode
        ) {
            return;
        }


        const btn =
            document.createElement(
                'button'
            );


        btn.id =
            BUTTON_ID;


        btn.type =
            'button';


        btn.style.cssText = `
            margin-left: 10px;
            padding: 5px 12px;
            border: 1px solid #000000;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-family: inherit;
            height: 40px;
            align-self: center;
            transition: all 0.2s ease-in-out;
            white-space: nowrap;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,.15);
        `;


        setButtonDefaultState(
            btn
        );


        // =================================================================
        // HOVER
        // =================================================================

        btn.onmouseover =
            () => {

                if (
                    btn.dataset.loading
                ) {
                    return;
                }


                if (
                    btn.dataset.noticeActive ===
                    'true'
                ) {
                    return;
                }


                btn.style.backgroundColor =
                    '#16a34a';


                btn.style.color =
                    '#000000';
            };


        btn.onmouseout =
            () => {

                if (
                    btn.dataset.loading
                ) {
                    return;
                }


                if (
                    btn.dataset.noticeActive ===
                    'true'
                ) {
                    return;
                }


                setButtonDefaultState(
                    btn
                );
            };


        // =================================================================
        // NOVA CONSULTA
        // =================================================================

        btn.addEventListener(
            'click',

            () => {

                if (
                    btn.dataset.loading
                ) {
                    return;
                }


                limparEstadoAviso(
                    btn
                );


                const serialValue =
                    inputEl.value
                        ?.trim()
                    ||
                    '';


                if (!serialValue) {

                    setButtonDefaultState(
                        btn
                    );


                    alert(
                        'O campo do serial está vazio!'
                    );


                    return;
                }


                const oltEl =
                    document.querySelector(
                        '#authenticationAccessPointId'
                    );


                const rawOlt =
                    oltEl
                        ? (
                            oltEl.value ||
                            oltEl.innerText ||
                            oltEl.textContent ||
                            ''
                        )
                        : '';


                const oltTraduzida =
                    traduzirAccessPoint(
                        rawOlt
                    );


                console.log(
                    '[RX AUTOMATION] Access Point:',
                    rawOlt
                );


                console.log(
                    '[RX AUTOMATION] OLT traduzida:',
                    oltTraduzida
                );


                removerBotaoCopiar();


                btn.dataset.loading =
                    'true';


                btn.innerHTML =
                    '<span style="font-size:18px;letter-spacing:2px;">...</span>';


                btn.style.backgroundColor =
                    '#eab308';


                btn.style.color =
                    '#000000';


                const payload =
                    JSON.stringify({
                        serial:
                            serialValue,

                        olt:
                            oltTraduzida,

                        timestamp:
                            Date.now()
                    });


                GM_setValue(
                    REQUEST_KEY,
                    ''
                );


                setTimeout(
                    () => {

                        GM_setValue(
                            REQUEST_KEY,
                            payload
                        );

                    },
                    100
                );
            }
        );


        // =================================================================
        // LAYOUT
        // =================================================================

        container.parentNode.style.display =
            'flex';


        container.parentNode.style.alignItems =
            'center';


        container.parentNode.insertBefore(
            btn,
            container.nextSibling
        );
    }


    // =====================================================================
    // OBSERVER
    // =====================================================================

    const observer =
        new MutationObserver(
            () => {

                injetarBotaoSeNecessario();

            }
        );


    observer.observe(
        document.body,
        {
            childList:
                true,

            subtree:
                true
        }
    );


    injetarBotaoSeNecessario();


    // =====================================================================
    // RESULTADO
    // =====================================================================

    GM_addValueChangeListener(
        RESULT_KEY,

        function (
            name,
            oldValue,
            rawResult,
            remote
        ) {

            if (
                !remote ||
                !rawResult
            ) {
                return;
            }


            const btn =
                document.getElementById(
                    BUTTON_ID
                );


            if (!btn) {
                return;
            }


            let resultado;


            try {

                resultado =
                    JSON.parse(
                        rawResult
                    );

            }
            catch (error) {

                console.error(
                    '[RX AUTOMATION] Resultado inválido:',
                    error
                );


                return;
            }


            delete btn.dataset.loading;


            // =================================================================
            // ERRO
            // =================================================================

            if (
                resultado.tipo ===
                'erro'
            ) {

                removerBotaoCopiar();


                setButtonErrorState(
                    btn,
                    resultado.mensagem
                    ||
                    'ERRO: Falha na consulta'
                );


                return;
            }


            // =================================================================
            // SUCESSO
            // =================================================================

            if (
                resultado.tipo ===
                'sucesso'
            ) {

                const rxValue =
                    String(
                        resultado.rx ??
                        ''
                    )
                        .trim();


                if (!rxValue) {

                    removerBotaoCopiar();


                    setButtonErrorState(
                        btn,
                        'ERRO: Valor RX em branco'
                    );


                    return;
                }


                criarOuAtualizarBotaoCopiar(
                    btn,
                    rxValue
                );


                if (
                    resultado.oltDiferente ===
                    true
                ) {

                    setButtonDifferentOltState(
                        btn
                    );
                }
                else {

                    setButtonDefaultState(
                        btn
                    );
                }
            }


            setTimeout(
                () => {

                    GM_setValue(
                        RESULT_KEY,
                        ''
                    );

                },
                200
            );
        }
    );

})();
