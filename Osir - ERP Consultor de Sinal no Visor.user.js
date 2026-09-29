// ==UserScript==
// @name         Osir - ERP Consultor de Sinal no Visor
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      2.2
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
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20ERP%20Consultor%20de%20Sinal%20no%20Visor.user.js
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20ERP%20Consultor%20de%20Sinal%20no%20Visor.user.js
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// ==/UserScript==

(function() {
    'use strict';

    // =====================================================================
    // MAPA DE TRADUÇÃO DAS OLTs
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
    // TRADUÇÃO DO PONTO DE ACESSO
    // =====================================================================

    function traduzirAccessPoint(rawText) {
        if (!rawText) {
            return '';
        }

        let cleaned = rawText.trim();

        // Remove "Fibra" do início
        cleaned = cleaned.replace(/^Fibra\s+/i, '');

        // Remove "Slot XX Porta XX" do final
        cleaned = cleaned
            .replace(/\s+Slot\s+\d+\s+Porta\s+\d+$/i, '')
            .trim();

        // Mapeamentos especiais
        if (MAPA_OLT[cleaned]) {
            return MAPA_OLT[cleaned];
        }

        // Regra padrão
        if (
            !cleaned.startsWith('OLT ') &&
            !cleaned.startsWith('OTL ')
        ) {
            return `OLT ${cleaned}`;
        }

        return cleaned;
    }


    // =====================================================================
    // HELPER PARA INPUTS REACT
    // =====================================================================

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
    // VISOR OSIR
    // =====================================================================

    if (window.location.href.includes('visor.osir.net.br')) {

        console.log(
            '[RX AUTOMATION] Visor OSIR detectado. Aguardando requisições...'
        );


        const sleep = (ms) =>
            new Promise(resolve => setTimeout(resolve, ms));


        function normalizarTexto(texto) {
            return (texto || '')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase();
        }


        // =================================================================
        // AGUARDA UM ELEMENTO EXISTIR
        // =================================================================

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


        // =================================================================
        // BOTÕES CIDADE / OLT
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
                        ) === 'OLT'
                ) ||
                botoes[1] ||
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
                        ) === 'CIDADE'
                ) ||
                botoes[0] ||
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
                        btn.offsetParent !== null
                ) ||
                botoes[0] ||
                null
            );
        }


        // =================================================================
        // DETECTA "ONT NÃO ENCONTRADA NESTA OLT"
        // =================================================================

        function encontrarAvisoOntNaoEncontradaNaOlt() {

            const divs =
                Array.from(
                    document.querySelectorAll('div')
                );

            return (
                divs.find(div => {

                    const texto =
                        normalizarTexto(
                            div.textContent
                        );

                    return (
                        texto ===
                        'ONT NÃO ENCONTRADA NESTA OLT'
                    );

                }) ||
                null
            );
        }


        // =================================================================
        // SELETOR DE OLT
        // =================================================================

        function encontrarSeletorOlt() {

            const candidatos =
                Array.from(
                    document.querySelectorAll(
                        'div.fade-swap > div.relative > button[type="button"]'
                    )
                );


            return candidatos.find(btn => {

                const texto =
                    normalizarTexto(
                        btn.textContent
                    );

                return (
                    texto === 'SELECIONE UMA OLT' ||
                    texto.startsWith('OLT ') ||
                    texto.startsWith('OTL ') ||
                    texto === 'RG_QNT'
                );

            }) || null;
        }


        // =================================================================
        // SELECIONA A OLT
        // =================================================================

        async function selecionarOlt(olt) {

            const oltNormalizada =
                normalizarTexto(olt);


            if (!oltNormalizada) {
                throw new Error(
                    'OLT recebida está vazia'
                );
            }


            // -------------------------------------------------------------
            // Localiza seletor
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
            // Já está selecionada
            // -------------------------------------------------------------

            if (
                normalizarTexto(
                    seletor.textContent
                ) === oltNormalizada
            ) {
                console.log(
                    '[RX AUTOMATION] OLT já selecionada:',
                    olt
                );

                return;
            }


            // -------------------------------------------------------------
            // Abre dropdown
            // -------------------------------------------------------------

            console.log(
                '[RX AUTOMATION] Abrindo seletor de OLT...'
            );

            seletor.click();


            const wrapper =
                seletor.parentElement;


            // -------------------------------------------------------------
            // Campo Buscar OLT
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
            // Pesquisa
            // -------------------------------------------------------------

            campoBusca.focus();

            setNativeInputValue(
                campoBusca,
                olt
            );


            console.log(
                '[RX AUTOMATION] Pesquisando OLT:',
                olt
            );


            await sleep(250);


            // -------------------------------------------------------------
            // ArrowDown
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
            // Localiza opção
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


                        const exata =
                            opcoes.find(
                                btn =>
                                    normalizarTexto(
                                        btn.textContent
                                    ) === oltNormalizada
                            );


                        if (exata) {
                            return exata;
                        }


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
                '[RX AUTOMATION] Opção localizada:',
                opcao.textContent.trim()
            );


            // -------------------------------------------------------------
            // Seleciona
            // -------------------------------------------------------------

            opcao.click();


            // -------------------------------------------------------------
            // Confirma seleção
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
                '[RX AUTOMATION] OLT selecionada:',
                olt
            );
        }


        // =================================================================
        // INPUT SERIAL
        // =================================================================

        function encontrarInputSerial() {

            const inputs =
                Array.from(
                    document.querySelectorAll(
                        'input'
                    )
                )
                .filter(
                    input =>
                        input.getAttribute(
                            'placeholder'
                        ) !== 'Buscar OLT...'
                );


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


                    return identificacao.includes(
                        'SERIAL'
                    );
                });


            if (porIdentificacao) {
                return porIdentificacao;
            }


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
        // RECEBE SOLICITAÇÃO DO ERP
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
                    '[RX AUTOMATION] Requisição recebida:',
                    {
                        serial,
                        olt
                    }
                );


                try {

                    // =====================================================
                    // 1. MODO OLT
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
                    // 2. SELECIONA OLT
                    // =====================================================

                    await selecionarOlt(olt);


                    // =====================================================
                    // 3. SERIAL
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


                    serialInput.focus();


                    setNativeInputValue(
                        serialInput,
                        serial
                    );


                    console.log(
                        '[RX AUTOMATION] Serial preenchido:',
                        serial
                    );


                    await sleep(300);


                    // =====================================================
                    // 4. CONSULTAR
                    // =====================================================

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


                    submitBtn.disabled = false;


                    console.log(
                        '[RX AUTOMATION] Executando consulta via OLT...'
                    );


                    submitBtn.click();


                    // =====================================================
                    // 5. AGUARDA RESULTADO
                    // =====================================================

                    aguardarResultado(
                        serial,
                        false
                    );

                }
                catch (e) {

                    console.error(
                        '[RX AUTOMATION] Erro:',
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


        // =================================================================
        // FALLBACK PARA CIDADE
        // =================================================================

        async function tentarConsultaPorCidade(
            targetSerial,
            motivo
        ) {

            console.warn(
                `[RX AUTOMATION] Iniciando fallback para Cidade. Motivo: ${motivo}`
            );


            // =============================================================
            // 1. BOTÃO CIDADE
            // =============================================================

            const cidadeButton =
                await esperarElemento(
                    encontrarBotaoModoCidade,
                    3000
                );


            if (!cidadeButton) {

                console.error(
                    '[RX AUTOMATION] Botão Cidade não encontrado.'
                );


                GM_setValue(
                    'visor_serial_result',
                    'ERRO: Timeout (não carregou)'
                );

                return;
            }


            // =============================================================
            // 2. MUDA PARA CIDADE
            // =============================================================

            console.log(
                '[RX AUTOMATION] Mudando modo de consulta para Cidade...'
            );


            cidadeButton.click();


            /*
             * Aguarda React reconstruir os elementos do formulário.
             */
            await sleep(500);


            // =============================================================
            // 3. PROCURA NOVAMENTE O BOTÃO CONSULTAR
            // =============================================================

            const submitBtn =
                await esperarElemento(
                    encontrarBotaoConsultar,
                    3000,
                    100
                );


            if (!submitBtn) {

                console.error(
                    '[RX AUTOMATION] Botão Consultar não encontrado após selecionar Cidade.'
                );


                GM_setValue(
                    'visor_serial_result',
                    'ERRO: Timeout (não carregou)'
                );

                return;
            }


            // =============================================================
            // 4. CONSULTA NOVAMENTE
            // =============================================================

            submitBtn.disabled = false;


            console.log(
                '[RX AUTOMATION] Executando nova consulta via Cidade...'
            );


            submitBtn.click();


            // =============================================================
            // 5. AGUARDA SEGUNDA TENTATIVA
            // =============================================================

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
            fallbackCidadeJaTentado = false
        ) {

            let tentativas = 0;

            /*
             * 40 x 500 ms = aproximadamente 20 segundos
             */
            const maxTentativas = 40;


            console.log(
                fallbackCidadeJaTentado
                    ? '[RX AUTOMATION] Aguardando resultado da consulta via Cidade...'
                    : '[RX AUTOMATION] Aguardando resultado da consulta via OLT...'
            );


            const checkInterval =
                setInterval(() => {

                    tentativas++;


                    try {

                        // =================================================
                        // NOVO:
                        // "ONT NÃO ENCONTRADA NESTA OLT"
                        //
                        // Se aparecer na primeira consulta, não precisa
                        // esperar os 20 segundos do timeout.
                        // =================================================

                        if (!fallbackCidadeJaTentado) {

                            const avisoNaoEncontrada =
                                encontrarAvisoOntNaoEncontradaNaOlt();


                            if (avisoNaoEncontrada) {

                                clearInterval(
                                    checkInterval
                                );


                                console.warn(
                                    '[RX AUTOMATION] Visor informou: ONT não encontrada nesta OLT.'
                                );


                                console.warn(
                                    '[RX AUTOMATION] Indo imediatamente para consulta por Cidade.'
                                );


                                tentarConsultaPorCidade(
                                    targetSerial,
                                    'ONT não encontrada nesta OLT'
                                )
                                .catch(error => {

                                    console.error(
                                        '[RX AUTOMATION] Falha no fallback para Cidade:',
                                        error
                                    );


                                    GM_setValue(
                                        'visor_serial_result',
                                        'ERRO: Timeout (não carregou)'
                                    );

                                });


                                return;
                            }
                        }


                        // =================================================
                        // PROCURA RESULTADO RX
                        // =================================================

                        const spans =
                            Array.from(
                                document.querySelectorAll(
                                    'span'
                                )
                            );


                        const rxLabel =
                            spans.find(
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
                                ) ||
                                rxLabel.closest(
                                    'main'
                                ) ||
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
                                        .querySelector(
                                            '.text-2xl'
                                        );


                                if (rxContainer) {

                                    clearInterval(
                                        checkInterval
                                    );


                                    console.log(
                                        '[RX AUTOMATION] Resultado detectado. Aguardando estabilização...'
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
                                                        normalizarTexto(
                                                            s.textContent
                                                        ) ===
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
                                                '[RX AUTOMATION] Potência RX capturada:',
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


                        console.error(
                            '[RX AUTOMATION] Erro durante leitura do resultado:',
                            e
                        );


                        GM_setValue(
                            'visor_serial_result',
                            'ERRO: Falha na leitura'
                        );


                        return;
                    }


                    // =====================================================
                    // TIMEOUT
                    // =====================================================

                    if (
                        tentativas >=
                        maxTentativas
                    ) {

                        clearInterval(
                            checkInterval
                        );


                        // =================================================
                        // PRIMEIRO TIMEOUT
                        //
                        // Ainda estava consultando pela OLT.
                        // Executa fallback por Cidade.
                        // =================================================

                        if (!fallbackCidadeJaTentado) {

                            console.warn(
                                '[RX AUTOMATION] Timeout na consulta via OLT.'
                            );


                            console.warn(
                                '[RX AUTOMATION] Tentando consulta por Cidade...'
                            );


                            tentarConsultaPorCidade(
                                targetSerial,
                                'Timeout da consulta via OLT'
                            )
                            .catch(error => {

                                console.error(
                                    '[RX AUTOMATION] Falha no fallback para Cidade:',
                                    error
                                );


                                GM_setValue(
                                    'visor_serial_result',
                                    'ERRO: Timeout (não carregou)'
                                );

                            });


                            return;
                        }


                        // =================================================
                        // SEGUNDO TIMEOUT
                        //
                        // Cidade já foi tentada.
                        // Agora encerra definitivamente.
                        // =================================================

                        console.error(
                            '[RX AUTOMATION] Timeout também na consulta via Cidade.'
                        );


                        console.error(
                            '[RX AUTOMATION] Encerrando tentativa.'
                        );


                        GM_setValue(
                            'visor_serial_result',
                            'ERRO: Timeout (não carregou)'
                        );
                    }

                }, 500);
        }


        return;
    }


    // =====================================================================
    // ERP OSIR
    // =====================================================================

    const BUTTON_ID =
        'tm-visor-rx-button';


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


    // =====================================================================
    // ESTADO PADRÃO DO BOTÃO
    // =====================================================================

    function setButtonDefaultState(btn) {

        btn.innerHTML =
            EYE_ICON_SVG;


        btn.style.backgroundColor =
            '#22c55e';


        btn.style.color =
            '#000000';
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


        setButtonDefaultState(
            btn
        );


        // =================================================================
        // HOVER
        // =================================================================

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


        // =================================================================
        // CLIQUE
        // =================================================================

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


                // =========================================================
                // CAPTURA OLT
                // =========================================================

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
                    '[RX AUTOMATION] OLT original:',
                    rawOlt
                );


                console.log(
                    '[RX AUTOMATION] OLT traduzida:',
                    oltTraduzida
                );


                // =========================================================
                // LOADING
                // =========================================================

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


                // =========================================================
                // PAYLOAD
                // =========================================================

                const payload =
                    JSON.stringify({
                        serial:
                            serialValue,

                        olt:
                            oltTraduzida
                    });


                // =========================================================
                // ENVIA PARA O VISOR
                // =========================================================

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
    // OBSERVER DA SPA
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


                // =========================================================
                // COPIA RX
                // =========================================================

                if (
                    !rx_value.includes(
                        'ERRO'
                    )
                ) {

                    GM_setClipboard(
                        rx_value
                    );
                }


                // =========================================================
                // ATUALIZA BOTÃO
                // =========================================================

                if (btn) {

                    delete btn.dataset.loading;


                    if (
                        rx_value.includes(
                            'ERRO'
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


                    // =====================================================
                    // RESTAURA BOTÃO EM 5 SEGUNDOS
                    // =====================================================

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


                // =========================================================
                // LIMPA RESULTADO COMPARTILHADO
                // =========================================================

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
