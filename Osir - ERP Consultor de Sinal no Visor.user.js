// ==UserScript==
// @name         Osir - ERP Consultor de Sinal no Visor
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      1.8
// @description  Copia o serial e a OLT traduzida, cola na aba do visor (modo OLT), consulta e retorna a potência RX
// @author       Lucashackd
// @match        https://erp.osirnet.com.br/ui/*/legacy/operations/**
// @match        *://*.osirnet.com.br/*
// @match        https://visor.osir.net.br/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_setClipboard
// @license      MIT
// @homepageURL  https://github.com/Lucashackd/Scripts-Osirnet
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// ==/UserScript==

(function() {
    'use strict';

    // Map com substituições diretas / exceções de mapeamento
    const MAPA_OLT = {
        'PLTDU': 'OLT DU',
        'RGPQM': 'OLT RG_PQM',
        'RG_CE': 'OLT RG_CE_1',
        'STL_CE3_R': 'OLT CE3_R',
        'CSS1': 'OLT CSS_1',
        'RGJUN1': 'OLT RG_JUN_1',
        'RGQNT': 'RG_QNT',
        'SVPGAB': 'OLT GAB',
        'SVPLDA': 'OLT LDA',
        'ROS': 'OLT ROS',
        'GAR': 'OLT GAR',
        'ZN': 'OLT ZN',
        'FGT': 'OLT FGT',
        'GER': 'OLT GER',
        'VCII': 'OLT VCII'
    };

    /**
     * Função para traduzir o texto do Access Point
     * para o nome da OLT no Visor.
     */
    function traduzirAccessPoint(rawText) {
        if (!rawText) return '';

        // 1. Limpa espaços extras
        let cleaned = rawText.trim();

        // 2. Remove "Fibra" do início
        cleaned = cleaned.replace(/^Fibra\s+/i, '');

        // 3. Remove "Slot XX Porta XX" do final
        cleaned = cleaned
            .replace(/\s+Slot\s+\d+\s+Porta\s+\d+$/i, '')
            .trim();

        // 4. Verifica mapeamentos específicos
        if (MAPA_OLT[cleaned]) {
            return MAPA_OLT[cleaned];
        }

        // 5. Regra padrão
        if (
            !cleaned.startsWith('OLT ') &&
            !cleaned.startsWith('OTL ')
        ) {
            return `OLT ${cleaned}`;
        }

        return cleaned;
    }

    /**
     * Define valor em input disparando os eventos
     * necessários para frameworks como React.
     */
    function setNativeInputValue(input, value) {
        const nativeSetter = Object
            .getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
            )
            .set;

        nativeSetter.call(input, value);

        input.dispatchEvent(
            new Event('input', {
                bubbles: true
            })
        );

        input.dispatchEvent(
            new Event('change', {
                bubbles: true
            })
        );
    }


    // =====================================================================
    // LÓGICA PARA A PÁGINA DO VISOR OSIR
    // =====================================================================

    if (window.location.href.includes('visor.osir.net.br')) {

        console.log(
            "Visor OSIR detectado. Aguardando requisições..."
        );

        const sleep = (ms) =>
            new Promise(resolve => setTimeout(resolve, ms));


        /**
         * Normaliza texto para facilitar comparações.
         */
        function normalizarTexto(texto) {
            return (texto || '')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase();
        }


        /**
         * Espera um elemento aparecer no DOM.
         */
        async function esperarElemento(
            getElement,
            timeout = 5000,
            intervalo = 100
        ) {
            const inicio = Date.now();

            while (Date.now() - inicio < timeout) {

                const elemento = getElement();

                if (elemento) {
                    return elemento;
                }

                await sleep(intervalo);
            }

            return null;
        }


        /**
         * Localiza o botão que muda o modo para OLT.
         */
        function encontrarBotaoModoOlt() {

            const container =
                document.querySelector(
                    'div.relative.grid.grid-cols-2'
                );

            if (!container) {
                return null;
            }

            const botoes =
                Array.from(
                    container.querySelectorAll('button')
                );

            return (
                botoes.find(
                    btn =>
                        normalizarTexto(btn.textContent) === 'OLT'
                ) ||
                botoes[1] ||
                null
            );
        }


        /**
         * Localiza o botão principal do seletor de OLT.
         *
         * Estrutura:
         *
         * .fade-swap
         *   .relative
         *      button
         *      input Buscar OLT...
         *      button[data-index]
         */
        function encontrarSeletorOlt() {

            const candidatos =
                Array.from(
                    document.querySelectorAll(
                        'div.fade-swap > div.relative > button[type="button"]'
                    )
                );

            return candidatos.find(btn => {

                const texto =
                    normalizarTexto(btn.textContent);

                return (
                    texto === 'SELECIONE UMA OLT' ||
                    texto.startsWith('OLT ') ||
                    texto.startsWith('OTL ') ||
                    texto === 'RG_QNT'
                );

            }) || null;
        }


        /**
         * Abre o seletor de OLT,
         * pesquisa a OLT desejada
         * e seleciona a opção correta.
         */
        async function selecionarOlt(olt) {

            const oltNormalizada =
                normalizarTexto(olt);

            if (!oltNormalizada) {
                throw new Error(
                    'OLT recebida está vazia'
                );
            }


            // -------------------------------------------------------------
            // 1. Localiza botão do seletor
            // -------------------------------------------------------------

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


            // -------------------------------------------------------------
            // 2. Verifica se já está selecionada
            // -------------------------------------------------------------

            if (
                normalizarTexto(
                    seletor.textContent
                ) === oltNormalizada
            ) {
                console.log(
                    'OLT já selecionada:',
                    olt
                );

                return;
            }


            // -------------------------------------------------------------
            // 3. Abre dropdown
            // -------------------------------------------------------------

            console.log(
                'Abrindo seletor de OLT...'
            );

            seletor.click();


            const wrapper =
                seletor.parentElement;


            // -------------------------------------------------------------
            // 4. Localiza campo "Buscar OLT..."
            // -------------------------------------------------------------

            const campoBusca =
                await esperarElemento(
                    () =>
                        wrapper?.querySelector(
                            'input[placeholder="Buscar OLT..."]'
                        ),
                    3000
                );


            if (!campoBusca) {
                throw new Error(
                    'Campo de busca da OLT não encontrado'
                );
            }


            // -------------------------------------------------------------
            // 5. Digita a OLT traduzida
            // -------------------------------------------------------------

            console.log(
                'Pesquisando OLT:',
                olt
            );

            campoBusca.focus();

            setNativeInputValue(
                campoBusca,
                olt
            );


            // Aguarda React atualizar a lista
            await sleep(250);


            // -------------------------------------------------------------
            // 6. Pressiona seta para baixo
            // -------------------------------------------------------------

            campoBusca.dispatchEvent(
                new KeyboardEvent(
                    'keydown',
                    {
                        key: 'ArrowDown',
                        code: 'ArrowDown',
                        keyCode: 40,
                        which: 40,
                        bubbles: true
                    }
                )
            );


            campoBusca.dispatchEvent(
                new KeyboardEvent(
                    'keyup',
                    {
                        key: 'ArrowDown',
                        code: 'ArrowDown',
                        keyCode: 40,
                        which: 40,
                        bubbles: true
                    }
                )
            );


            // -------------------------------------------------------------
            // 7. Localiza opção correspondente
            // -------------------------------------------------------------

            const opcao =
                await esperarElemento(
                    () => {

                        const opcoes =
                            Array.from(
                                wrapper?.querySelectorAll(
                                    'button[data-index]'
                                ) || []
                            );


                        // Correspondência EXATA
                        const exata =
                            opcoes.find(btn =>

                                normalizarTexto(
                                    btn.textContent
                                ) === oltNormalizada

                            );


                        if (exata) {
                            return exata;
                        }


                        /*
                         * Caso a pesquisa tenha deixado
                         * somente uma opção disponível,
                         * usamos essa opção como fallback.
                         */
                        if (opcoes.length === 1) {
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


            console.log(
                'Opção localizada:',
                opcao.textContent.trim()
            );


            // -------------------------------------------------------------
            // 8. Seleciona a OLT
            // -------------------------------------------------------------

            opcao.click();


            // -------------------------------------------------------------
            // 9. Confirma que a seleção realmente ocorreu
            // -------------------------------------------------------------

            const selecionada =
                await esperarElemento(
                    () => {

                        const seletorAtual =
                            encontrarSeletorOlt();

                        return (
                            seletorAtual &&
                            normalizarTexto(
                                seletorAtual.textContent
                            ) === oltNormalizada
                        )
                            ? seletorAtual
                            : null;

                    },
                    3000,
                    100
                );


            if (!selecionada) {

                throw new Error(
                    `Falha ao confirmar a seleção da OLT: ${olt}`
                );

            }


            console.log(
                'OLT selecionada com sucesso:',
                olt
            );
        }


        /**
         * Localiza o input do serial.
         *
         * O input "Buscar OLT..." precisa ser ignorado.
         */
        function encontrarInputSerial() {

            const inputs =
                Array.from(
                    document.querySelectorAll('input')
                )
                .filter(
                    input =>
                        input.getAttribute(
                            'placeholder'
                        ) !== 'Buscar OLT...'
                );


            // -------------------------------------------------------------
            // Primeiro tenta localizar por atributos
            // -------------------------------------------------------------

            const porIdentificacao =
                inputs.find(input => {

                    const identificacao =
                        normalizarTexto(
                            [
                                input.id,
                                input.name,
                                input.placeholder,
                                input.getAttribute(
                                    'aria-label'
                                )
                            ]
                            .filter(Boolean)
                            .join(' ')
                        );


                    return identificacao
                        .includes('SERIAL');

                });


            if (porIdentificacao) {
                return porIdentificacao;
            }


            // -------------------------------------------------------------
            // Fallback:
            // procura primeiro input visível
            // -------------------------------------------------------------

            return (
                inputs.find(
                    input =>
                        input.offsetParent !== null
                ) ||
                inputs[0] ||
                null
            );
        }


        // =================================================================
        // RECEBE SOLICITAÇÃO VINDO DO ERP
        // =================================================================

        GM_addValueChangeListener(
            'visor_serial_request',
            async function(
                name,
                old_value,
                data,
                remote
            ) {

                if (!remote || !data) {
                    return;
                }


                const {
                    serial,
                    olt
                } =
                    typeof data === 'string'
                        ? JSON.parse(data)
                        : data;


                console.log(
                    "Requisição recebida:",
                    {
                        serial,
                        olt
                    }
                );


                try {

                    // =====================================================
                    // 1. MUDA PARA MODO OLT
                    // =====================================================

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


                    await sleep(300);


                    // =====================================================
                    // 2. SELECIONA A OLT
                    // =====================================================

                    await selecionarOlt(olt);


                    // =====================================================
                    // 3. LOCALIZA INPUT DO SERIAL
                    // =====================================================

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


                    // =====================================================
                    // 4. PREENCHE SERIAL
                    // =====================================================

                    console.log(
                        'Preenchendo serial:',
                        serial
                    );


                    serialInput.focus();


                    setNativeInputValue(
                        serialInput,
                        serial
                    );


                    // Aguarda atualização do React
                    await sleep(300);


                    // =====================================================
                    // 5. CLICA EM CONSULTAR
                    // =====================================================

                    const submitBtn =
                        document.querySelector(
                            'button[type="submit"]'
                        );


                    if (!submitBtn) {

                        throw new Error(
                            'Botão Consultar não encontrado'
                        );

                    }


                    submitBtn.disabled = false;


                    console.log(
                        'Executando consulta...'
                    );


                    submitBtn.click();


                    // =====================================================
                    // 6. ESPERA RESULTADO
                    // =====================================================

                    aguardarResultado(serial);


                }
                catch (e) {

                    console.error(
                        "Erro no processamento do Visor:",
                        e
                    );


                    GM_setValue(
                        'visor_serial_result',
                        `ERRO: ${
                            e.message ||
                            'Falha ao preencher Visor'
                        }`
                    );

                }

            }
        );


        /**
         * Aguarda o resultado da consulta
         * e captura a potência RX.
         */
        function aguardarResultado(targetSerial) {

            let tentativas = 0;

            const maxTentativas = 40;


            const checkInterval =
                setInterval(() => {

                    tentativas++;


                    try {

                        const spans =
                            Array.from(
                                document.querySelectorAll(
                                    'span'
                                )
                            );


                        const rxLabel =
                            spans.find(
                                span =>
                                    span
                                        .textContent
                                        .trim()
                                        .toUpperCase()
                                    ===
                                    'POTÊNCIA RX'
                            );


                        if (rxLabel) {

                            const resultCard =
                                rxLabel.closest(
                                    '.result-pop'
                                ) ||
                                rxLabel.closest(
                                    'main'
                                ) ||
                                document.body;


                            const cardText =
                                resultCard
                                    .textContent
                                    .toUpperCase();


                            if (
                                cardText.includes(
                                    targetSerial
                                        .toUpperCase()
                                )
                            ) {

                                const rxContainer =
                                    rxLabel
                                        .parentElement
                                        .querySelector(
                                            '.text-2xl'
                                        );


                                if (rxContainer) {

                                    clearInterval(
                                        checkInterval
                                    );


                                    console.log(
                                        "Resultado detectado. Aguardando 1 segundo para estabilização da div..."
                                    );


                                    setTimeout(() => {

                                        const spanAtualizado =
                                            Array
                                                .from(
                                                    document.querySelectorAll(
                                                        'span'
                                                    )
                                                )
                                                .find(
                                                    s =>
                                                        s
                                                            .textContent
                                                            .trim()
                                                            .toUpperCase()
                                                        ===
                                                        'POTÊNCIA RX'
                                                );


                                        const containerAtualizado =
                                            spanAtualizado
                                                ? spanAtualizado
                                                    .parentElement
                                                    .querySelector(
                                                        '.text-2xl'
                                                    )
                                                : null;


                                        const rxValue =
                                            containerAtualizado
                                                ? containerAtualizado
                                                    .textContent
                                                    .trim()
                                                : '';


                                        if (rxValue) {

                                            console.log(
                                                "Potência RX capturada após 1s:",
                                                rxValue
                                            );


                                            GM_setValue(
                                                'visor_serial_result',
                                                rxValue
                                            );

                                        }
                                        else {

                                            GM_setValue(
                                                'visor_serial_result',
                                                'ERRO: Valor RX em branco'
                                            );

                                        }

                                    }, 1000);


                                    return;
                                }
                            }
                        }

                    }
                    catch (e) {

                        clearInterval(
                            checkInterval
                        );


                        GM_setValue(
                            'visor_serial_result',
                            'ERRO: Falha na leitura'
                        );


                        return;
                    }


                    // Timeout após ~20 segundos
                    if (
                        tentativas >=
                        maxTentativas
                    ) {

                        clearInterval(
                            checkInterval
                        );


                        GM_setValue(
                            'visor_serial_result',
                            'ERRO: Timeout (não carregou)'
                        );

                    }

                }, 500);
        }


        /*
         * Não continua executando a parte destinada
         * ao ERP quando estivermos no Visor.
         */
        return;
    }



    // =====================================================================
    // LÓGICA PARA O SISTEMA PRINCIPAL (ERP OSIR)
    // =====================================================================

    const BUTTON_ID =
        'tm-visor-rx-button';


    // Ícone de olho SVG
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


    /**
     * Restaura o botão para o estado inicial.
     */
    function setButtonDefaultState(btn) {

        btn.innerHTML =
            EYE_ICON_SVG;

        btn.style.backgroundColor =
            '#22c55e';

        btn.style.color =
            '#000000';
    }


    /**
     * Injeta botão ao lado do serial.
     */
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


        btn.title =
            'Consultar Potência RX no Visor OSIR';


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
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        `;


        setButtonDefaultState(btn);


        // Hover
        btn.onmouseover = () => {

            if (!btn.dataset.loading) {

                btn.style.backgroundColor =
                    '#16a34a';

                btn.style.color =
                    '#000000';

            }
        };


        btn.onmouseout = () => {

            if (!btn.dataset.loading) {

                setButtonDefaultState(
                    btn
                );

            }
        };


        // ================================================================
        // CLIQUE NO BOTÃO
        // ================================================================

        btn.addEventListener(
            'click',
            () => {

                const serialValue =
                    inputEl.value
                        ? inputEl.value.trim()
                        : '';


                if (!serialValue) {

                    alert(
                        'O campo do serial está vazio!'
                    );

                    return;
                }


                // ---------------------------------------------------------
                // Captura ponto de acesso / OLT
                // ---------------------------------------------------------

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
                    'OLT original:',
                    rawOlt
                );


                console.log(
                    'OLT traduzida:',
                    oltTraduzida
                );


                // ---------------------------------------------------------
                // Estado de carregamento
                // ---------------------------------------------------------

                btn.dataset.loading =
                    'true';


                btn.innerHTML =
                    `<span style="
                        font-size: 18px;
                        letter-spacing: 2px;
                    ">...</span>`;


                btn.style.backgroundColor =
                    '#eab308';


                btn.style.color =
                    '#000000';


                // ---------------------------------------------------------
                // Cria payload
                // ---------------------------------------------------------

                const payload =
                    JSON.stringify({

                        serial:
                            serialValue,

                        olt:
                            oltTraduzida

                    });


                // ---------------------------------------------------------
                // Reseta chave para sempre gerar evento
                // ---------------------------------------------------------

                GM_setValue(
                    'visor_serial_request',
                    ''
                );


                setTimeout(
                    () => {

                        GM_setValue(
                            'visor_serial_request',
                            payload
                        );

                    },
                    100
                );

            }
        );


        // ================================================================
        // ALINHAMENTO
        // ================================================================

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
    // OBSERVER PARA SPA
    // =====================================================================

    const observer =
        new MutationObserver(() => {

            injetarBotaoSeNecessario();

        });


    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );


    injetarBotaoSeNecessario();



    // =====================================================================
    // RECEBE RESULTADO DO VISOR
    // =====================================================================

    GM_addValueChangeListener(
        'visor_serial_result',
        function(
            name,
            old_value,
            rx_value,
            remote
        ) {

            if (
                remote &&
                rx_value
            ) {

                const btn =
                    document.getElementById(
                        BUTTON_ID
                    );


                // ---------------------------------------------------------
                // Copia RX
                // ---------------------------------------------------------

                if (
                    !rx_value.includes(
                        "ERRO"
                    )
                ) {

                    GM_setClipboard(
                        rx_value
                    );

                }


                // ---------------------------------------------------------
                // Atualiza botão
                // ---------------------------------------------------------

                if (btn) {

                    delete btn.dataset.loading;


                    if (
                        rx_value.includes(
                            "ERRO"
                        )
                    ) {

                        btn.innerHTML =
                            `<span>${rx_value}</span>`;


                        btn.style.backgroundColor =
                            '#ef4444';


                        btn.style.color =
                            '#ffffff';

                    }
                    else {

                        btn.innerHTML =
                            `${EYE_ICON_SVG}
                             <span>
                                ${rx_value}
                             </span>`;


                        btn.style.backgroundColor =
                            '#3b82f6';


                        btn.style.color =
                            '#ffffff';

                    }


                    // -----------------------------------------------------
                    // Volta ao estado inicial após 5 segundos
                    // -----------------------------------------------------

                    setTimeout(
                        () => {

                            if (
                                btn &&
                                !btn.dataset.loading
                            ) {

                                setButtonDefaultState(
                                    btn
                                );

                            }

                        },
                        5000
                    );

                }


                // ---------------------------------------------------------
                // Limpa valor compartilhado
                // ---------------------------------------------------------

                setTimeout(
                    () => {

                        GM_setValue(
                            'visor_serial_result',
                            ''
                        );

                    },
                    200
                );

            }
        }
    );

})();
