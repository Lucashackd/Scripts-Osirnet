// ==UserScript==
// @name         Osir - Aproprias
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      8.7
// @description  Apropriação automática
// @author       AlissonGuerreiro & Lucashackd
// @match        https://erp.osirnet.com.br/ui/*/workspace/activities
// @match        *://*.osirnet.com.br/*
// @exclude      https://chat.osirnet.com.br/*
// @exclude      https://erp.osirnet.com.br/ui/*/legacy/operations/*
// @grant        none
// @run-at       document-end
// @license      MIT
// @homepageURL  https://github.com/Lucashackd/Scripts-Osirnet
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20Aproprias.user.js
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/Osir%20-%20Aproprias.user.js
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================
    // CONFIGURAÇÕES
    // =========================================================

    const DELAYS = {
        APOS_SELECIONAR: 1100,
        APOS_CLICAR: 1100,
        APOS_CONFIRMAR: 1300
    };

    const DELAY_ENTRE_LOOPS = 2300;

    // =========================================================
    // CONTROLE
    // =========================================================

    let executando = false;
    let pausado = false;
    let parar = false;

    let contador = 0;
    let totalDesejado = 0;

    // =========================================================
    // DETECTA SE UMA SOLICITAÇÃO ESTÁ ABERTA
    // =========================================================

    function paginaBloqueada() {
    // =========================================================
    // 1. DETECTA O DRAWER "AÇÕES DA SOLICITAÇÃO"
    // =========================================================

    const drawers =
        document.querySelectorAll('.MuiDrawer-paper');

    const solicitacaoAberta =
        Array.from(drawers).some(drawer => {
            const texto =
                drawer.textContent || '';

            return (
                texto.includes('Ações da Solicitação') &&
                texto.includes('Dados Gerais') &&
                drawer.querySelector('#panelSideContainer')
            );
        });

    if (solicitacaoAberta) {
        return true;
    }

    // =========================================================
    // 2. DETECTA O PAINEL "DETALHES / HISTÓRICO"
    // =========================================================

    const painelDetalhes =
        document.querySelector('#nav-tabpanel-0');

    const painelHistorico =
        document.querySelector('#nav-tabpanel-1');

    if (
        painelDetalhes &&
        painelHistorico
    ) {
        const container =
            painelDetalhes.closest(
                '.MuiGrid-root'
            );

        if (container) {
            const texto =
                container.textContent || '';

            const temDetalhes =
                texto.includes('Detalhes');

            const temHistorico =
                texto.includes('Histórico');

            const temCodigo =
                texto.includes('Código');

            const temTitulo =
                texto.includes('Título');

            if (
                temDetalhes &&
                temHistorico &&
                temCodigo &&
                temTitulo
            ) {
                return true;
            }
        }
    }

    return false;
}

    // =========================================================
    // PAINEL
    // =========================================================

    function iniciarPainel() {
        if (!document.body) return;

        // =====================================================
        // REMOVE O PAINEL QUANDO UMA SOLICITAÇÃO ESTÁ ABERTA
        // =====================================================

        if (paginaBloqueada()) {
            const painelExistente = document.getElementById('meu-painel-automacao');
            if (painelExistente) {
                painelExistente.remove();
            }

            return;
        }

        // Evita duplicação
        if (
            document.getElementById(
                'meu-painel-automacao'
            )
        ) {
            return;
        }

        // =====================================================
        // VERIFICA SE A PÁGINA POSSUI A TABELA
        // =====================================================

        if (
            window.self === window.top &&
            document.querySelectorAll('iframe').length > 0
        ) {
            return;
        }

        const tabelaExiste =
            document.getElementById('assignmentTasks') ||
            document.querySelector('td');

        if (!tabelaExiste) return;

        // =====================================================
        // CSS
        // =====================================================

        if (
            !document.getElementById(
                'osir-futuristic-style'
            )
        ) {
            const style =
                document.createElement('style');

            style.id =
                'osir-futuristic-style';

            style.textContent = `

                #meu-painel-automacao {
                    position: fixed;

                    left: 0px;
                    bottom: 5px;

                    z-index: 9999999;

                    display: flex;
                    align-items: center;

                    height: 42px;

                    padding: 5px 7px;

                    gap: 5px;

                    background:
                        linear-gradient(
                            135deg,
                            rgba(7, 12, 25, .96),
                            rgba(15, 24, 42, .94)
                        );

                    border:
                        1px solid
                        rgba(0, 229, 255, .45);

                    border-radius: 12px;

                    box-shadow:
                        0 8px 30px
                        rgba(0, 0, 0, .40),

                        0 0 16px
                        rgba(0, 229, 255, .12),

                        inset 0 1px 0
                        rgba(255,255,255,.05);

                    backdrop-filter:
                        blur(14px);

                    -webkit-backdrop-filter:
                        blur(14px);

                    font-family:
                        Inter,
                        Arial,
                        sans-serif;

                    user-select: none;

                    box-sizing: border-box;

                    cursor: move;
                }


                #meu-painel-automacao * {
                    box-sizing: border-box;
                }


                /* =========================
                   ALÇA
                ========================== */

                .osir-refresh {
                    --accent: #00e5ff;
                }


                /* =========================
                   ALÇA
                ========================== */

                .osir-handle {
                    width: 24px;
                    height: 30px;

                    display: flex;

                    align-items: center;
                    justify-content: center;

                    color: #00e5ff;

                    font-size: 17px;

                    border-radius: 7px;

                    opacity: .75;

                    cursor: grab;

                    transition:
                        color .2s ease,
                        background .2s ease,
                        opacity .2s ease,
                        text-shadow .2s ease;
                }


                .osir-handle:hover {
                    opacity: 1;

                    background:
                        rgba(
                            0,
                            229,
                            255,
                            .08
                        );

                    text-shadow:
                        0 0 8px
                        #00e5ff;
                }


                .osir-handle:active {
                    cursor: grabbing;
                }


                /* =========================
                   INPUT
                ========================== */

                .osir-loop-input {
                    width: 55px;
                    height: 30px;

                    padding:
                        0 4px;

                    border:
                        1px solid
                        rgba(
                            0,
                            229,
                            255,
                            .30
                        );

                    border-radius: 7px;

                    outline: none;

                    background:
                        rgba(
                            255,
                            255,
                            255,
                            .035
                        );

                    color: #e6faff;

                    font-size: 12px;
                    font-weight: 700;

                    text-align: center;

                    transition:
                        border-color .2s ease,
                        box-shadow .2s ease,
                        background .2s ease;
                }


                .osir-loop-input:hover {
                    border-color:
                        rgba(
                            0,
                            229,
                            255,
                            .60
                        );
                }


                .osir-loop-input:focus {
                    border-color:
                        #00e5ff;

                    background:
                        rgba(
                            0,
                            229,
                            255,
                            .06
                        );

                    box-shadow:
                        0 0 10px
                        rgba(
                            0,
                            229,
                            255,
                            .25
                        );
                }


                .osir-loop-input::-webkit-inner-spin-button {
                    opacity: .5;
                }


                /* =========================
                   CONTADOR
                ========================== */

                .osir-counter {
                    min-width: 37px;
                    height: 30px;

                    padding:
                        0 7px;

                    display: flex;

                    align-items: center;
                    justify-content: center;

                    gap: 4px;

                    border:
                        1px solid
                        rgba(
                            124,
                            77,
                            255,
                            .38
                        );

                    border-radius: 7px;

                    background:
                        rgba(
                            124,
                            77,
                            255,
                            .08
                        );

                    color: #b69cff;

                    font-size: 11px;
                    font-weight: 800;

                    box-shadow:
                        inset 0 0 8px
                        rgba(
                            124,
                            77,
                            255,
                            .04
                        );
                }


                .osir-counter-icon {
                    font-size: 10px;

                    opacity: .8;
                }


                /* =========================
                   STATUS
                ========================== */

                .osir-status {
                    --status-color:
                        #00e676;

                    width: 30px;
                    height: 30px;

                    display: flex;

                    align-items: center;
                    justify-content: center;

                    border:
                        1px solid
                        color-mix(
                            in srgb,
                            var(--status-color) 60%,
                            transparent
                        );

                    border-radius: 7px;

                    background:
                        rgba(
                            255,
                            255,
                            255,
                            .025
                        );

                    color:
                        var(--status-color);

                    font-size: 12px;

                    transition:
                        color .25s ease,
                        border-color .25s ease,
                        box-shadow .25s ease;
                }


                .osir-status-light {
                    width: 7px;
                    height: 7px;

                    display: block;

                    border-radius: 50%;

                    background:
                        var(--status-color);

                    box-shadow:
                        0 0 5px
                        var(--status-color),

                        0 0 10px
                        var(--status-color);
                }


                .osir-status.executando
                .osir-status-light {
                    animation:
                        osir-pulse
                        1s
                        infinite;
                }


                @keyframes osir-pulse {

                    0% {
                        opacity: .45;

                        transform:
                            scale(.85);
                    }

                    50% {
                        opacity: 1;

                        transform:
                            scale(1.15);
                    }

                    100% {
                        opacity: .45;

                        transform:
                            scale(.85);
                    }
                }


                /* =========================
                   DIVISÓRIA
                ========================== */

                .osir-divider {
                    width: 1px;
                    height: 22px;

                    margin:
                        0 1px;

                    background:
                        linear-gradient(
                            transparent,
                            rgba(
                                0,
                                229,
                                255,
                                .42
                            ),
                            transparent
                        );
                }


                /* =========================
                   BOTÕES
                ========================== */

                .osir-action {
                    --accent:
                        #00e5ff;

                    width: 30px;
                    height: 30px;

                    display: flex;

                    align-items: center;
                    justify-content: center;

                    padding: 0;

                    border:
                        1px solid
                        var(--accent);

                    border-radius: 7px;

                    background:
                        rgba(
                            255,
                            255,
                            255,
                            .025
                        );

                    color:
                        var(--accent);

                    font-size: 12px;

                    cursor: pointer;

                    outline: none;

                    transition:
                        transform .13s ease,
                        background .18s ease,
                        box-shadow .18s ease,
                        opacity .18s ease;
                }


                .osir-action:not(:disabled):hover {
                    transform:
                        translateY(-1px);

                    background:
                        rgba(
                            255,
                            255,
                            255,
                            .08
                        );

                    box-shadow:
                        0 0 10px
                        var(--accent),

                        inset 0 0 8px
                        rgba(
                            255,
                            255,
                            255,
                            .03
                        );
                }


                .osir-action:not(:disabled):active {
                    transform:
                        scale(.92);
                }


                .osir-action:disabled {
                    opacity: .22;

                    cursor: default;

                    filter:
                        grayscale(.4);
                }


                .osir-play {
                    --accent:
                        #00e676;
                }


                .osir-pause {
                    --accent:
                        #ffab00;
                }


                .osir-stop {
                    --accent:
                        #ff1744;
                }

            `;

            document.head.appendChild(style);
        }

        // =====================================================
        // CONTAINER
        // =====================================================

        const painel =
            document.createElement('div');

        painel.id =
            'meu-painel-automacao';

        // =====================================================
        // HANDLE
        // =====================================================

        const handle =
            document.createElement('div');

        handle.className =
            'osir-handle';

        handle.innerText =
            '⠿';

        handle.title =
            'Arrastar painel';

        painel.appendChild(handle);

        // =====================================================
        // INPUT DE LOOPS
        // =====================================================

        const inputLoop =
            document.createElement('input');

        inputLoop.id =
            'input-loop';

        inputLoop.className =
            'osir-loop-input';

        inputLoop.type =
            'number';

        inputLoop.value =
            '1';

        inputLoop.min =
            '1';

        inputLoop.max =
            '999';

        inputLoop.title =
            'Quantidade de apropriações';

        inputLoop.setAttribute(
            'aria-label',
            'Quantidade de apropriações'
        );

        painel.appendChild(
            inputLoop
        );

        // =====================================================
        // CONTADOR
        // =====================================================

        const contadorContainer =
            document.createElement('div');

        contadorContainer.className =
            'osir-counter';

        contadorContainer.title =
            'Apropriações concluídas';

        const contadorIcon =
            document.createElement('span');

        contadorIcon.className =
            'osir-counter-icon';

        contadorIcon.innerText =
            '✓';

        const spanContador =
            document.createElement('span');

        spanContador.id =
            'contador-feitos';

        spanContador.innerText =
            '0';

        contadorContainer.appendChild(
            contadorIcon
        );

        contadorContainer.appendChild(
            spanContador
        );

        painel.appendChild(
            contadorContainer
        );

        // =====================================================
        // STATUS
        // =====================================================

        const statusDiv =
            document.createElement('div');

        statusDiv.id =
            'status-automacao';

        statusDiv.className =
            'osir-status';

        statusDiv.title =
            'Pronto';

        const statusLight =
            document.createElement('span');

        statusLight.className =
            'osir-status-light';

        statusDiv.appendChild(
            statusLight
        );

        painel.appendChild(
            statusDiv
        );

        // =====================================================
        // DIVISOR
        // =====================================================

        const divisor =
            document.createElement('div');

        divisor.className =
            'osir-divider';

        painel.appendChild(
            divisor
        );

        // =====================================================
        // PLAY
        // =====================================================

        const btnPlay =
            document.createElement('button');

        btnPlay.id =
            'btn-play';

        btnPlay.className =
            'osir-action osir-play';

        btnPlay.innerText =
            '▶';

        btnPlay.title =
            'Iniciar';

        btnPlay.setAttribute(
            'aria-label',
            'Iniciar'
        );

        painel.appendChild(
            btnPlay
        );

        // =====================================================
        // PAUSE
        // =====================================================

        const btnPause =
            document.createElement('button');

        btnPause.id =
            'btn-pause';

        btnPause.className =
            'osir-action osir-pause';

        btnPause.innerText =
            'Ⅱ';

        btnPause.title =
            'Pausar';

        btnPause.setAttribute(
            'aria-label',
            'Pausar'
        );

        btnPause.disabled =
            true;

        painel.appendChild(
            btnPause
        );

        // =====================================================
        // STOP
        // =====================================================

        const btnStop =
            document.createElement('button');

        btnStop.id =
            'btn-stop';

        btnStop.className =
            'osir-action osir-stop';

        btnStop.innerText =
            '■';

        btnStop.title =
            'Parar';

        btnStop.setAttribute(
            'aria-label',
            'Parar'
        );

        btnStop.disabled =
            true;

        painel.appendChild(
            btnStop
        );

        // =====================================================
        // ATUALIZAR LISTAGEM
        // =====================================================

        const btnRefresh =
              document.createElement('button');

        btnRefresh.id =
            'btn-refresh';

        btnRefresh.className =
            'osir-action osir-refresh';

        btnRefresh.innerText =
            '↻';

        btnRefresh.title =
            'Atualizar COP Encerramentos';

        btnRefresh.setAttribute(
            'aria-label',
            'Atualizar COP Encerramentos'
        );

        painel.appendChild(
            btnRefresh
        );

        // =====================================================
        // STATUS
        // =====================================================

        function atualizarStatus(
            msg,
            cor = '#90a4ae',
            animar = false
        ) {
            statusDiv.title =
                msg;

            statusDiv.style.setProperty(
                '--status-color',
                cor
            );

            if (animar) {
                statusDiv.classList.add(
                    'executando'
                );
            } else {
                statusDiv.classList.remove(
                    'executando'
                );
            }

            console.log(
                `📌 ${msg}`
            );
        }

        atualizarStatus(
            '🟢 Pronto',
            '#00e676'
        );

        // =====================================================
        // DELAY
        // =====================================================

        function delay(ms) {
            return new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        ms
                    )
            );
        }

        // =====================================================
        // EXECUTA APROPRIAÇÃO
        // =====================================================

        async function executarApropriacao() {
            const celulas =
                document.querySelectorAll(
                    'td'
                );

            let itemAlvo =
                null;

            let linhaAlvo =
                null;

            for (
                const el
                of celulas
            ) {
                const textoLimpo =
                    el.textContent
                        .replace(
                            /\s+/g,
                            ' '
                        )
                        .trim();

                if (
                    textoLimpo.includes(
                        'Sem Atendente / COP Encerramentos'
                    )
                ) {
                    itemAlvo =
                        el;

                    linhaAlvo =
                        el.closest(
                            'tr'
                        );

                    break;
                }
            }

            if (
                !itemAlvo ||
                !linhaAlvo
            ) {
                atualizarStatus(
                    '❌ Nenhum "Sem Atendente" encontrado!',
                    '#ff1744'
                );

                return false;
            }

            const id =
                linhaAlvo.getAttribute(
                    'data-id'
                );

            atualizarStatus(
                `✅ ID: ${id}`,
                '#00e676',
                true
            );

            itemAlvo.scrollIntoView({
                block: 'center',
                behavior: 'smooth'
            });

            await delay(200);

            document
                .querySelectorAll(
                    'tr.row_selected'
                )
                .forEach(tr => {
                    tr.classList.remove(
                        'row_selected'
                    );
                });

            linhaAlvo.classList.add(
                'row_selected'
            );

            [
                'mousedown',
                'mouseup',
                'click'
            ].forEach(tipo => {
                const evt =
                    new MouseEvent(
                        tipo,
                        {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        }
                    );

                linhaAlvo.dispatchEvent(
                    evt
                );
            });

            const primeiraCelula =
                linhaAlvo.querySelector(
                    'td'
                );

            if (
                primeiraCelula
            ) {
                primeiraCelula.dispatchEvent(
                    new Event(
                        'click',
                        {
                            bubbles: true
                        }
                    )
                );
            }

            itemAlvo.style.backgroundColor =
                '#c8e6c9';

            linhaAlvo.style.backgroundColor =
                '#e8f5e9';

            await delay(
                DELAYS.APOS_SELECIONAR
            );

            // =================================================
            // BOTÃO APROPRIAR
            // =================================================

            const btn =
                document.getElementById(
                    'change-responsible'
                );

            if (!btn) {
                atualizarStatus(
                    '❌ Botão não encontrado!',
                    '#ff1744'
                );

                return false;
            }

            if (
                btn.disabled
            ) {
                btn.disabled =
                    false;

                btn.style.opacity =
                    '1';

                btn.removeAttribute(
                    'disabled'
                );

                btn.classList.remove(
                    'disabled'
                );
            }

            btn.click();

            [
                'mousedown',
                'mouseup',
                'click'
            ].forEach(tipo => {
                const evt =
                    new MouseEvent(
                        tipo,
                        {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        }
                    );

                btn.dispatchEvent(
                    evt
                );
            });

            const icone =
                btn.querySelector(
                    'i'
                );

            if (icone) {
                icone.click();
            }

            atualizarStatus(
                '🔘 Apropriando...',
                '#00e5ff',
                true
            );

            await delay(
                DELAYS.APOS_CLICAR
            );

            // =================================================
            // CONFIRMAÇÃO
            // =================================================

            let btnSim =
                null;

            const dialogs =
                document.querySelectorAll(
                    '.ui-dialog'
                );

            for (
                const dialog
                of dialogs
            ) {
                if (
                    dialog.style.display !==
                        'none' &&
                    dialog.offsetParent !==
                        null
                ) {
                    const botoes =
                        dialog.querySelectorAll(
                            '.ui-dialog-buttonpane .ui-button'
                        );

                    for (
                        const botao
                        of botoes
                    ) {
                        if (
                            botao
                                .textContent
                                .trim() ===
                            'Sim'
                        ) {
                            btnSim =
                                botao;

                            break;
                        }
                    }

                    if (btnSim) {
                        break;
                    }
                }
            }

            if (btnSim) {
                btnSim.click();

                atualizarStatus(
                    '✅ Confirmado',
                    '#00e676',
                    true
                );
            } else {
                document.dispatchEvent(
                    new KeyboardEvent(
                        'keydown',
                        {
                            key: 'Enter'
                        }
                    )
                );

                document.dispatchEvent(
                    new KeyboardEvent(
                        'keyup',
                        {
                            key: 'Enter'
                        }
                    )
                );

                atualizarStatus(
                    '⚠️ Enter',
                    '#ffab00',
                    true
                );
            }

            linhaAlvo.style.backgroundColor =
                '#a5d6a7';

            linhaAlvo.style.border =
                '2px solid green';

            await delay(
                DELAYS.APOS_CONFIRMAR
            );

            return true;
        }

        // =====================================================
        // LOOP PRINCIPAL
        // =====================================================

        async function executarLoop() {
            if (executando) {
                return;
            }

            totalDesejado =
                parseInt(
                    inputLoop.value
                ) || 1;

            contador = 0;

            executando = true;
            pausado = false;
            parar = false;

            // =================================================
            // ESTADO EXECUTANDO
            // =================================================

            btnPlay.innerText =
                '↻';

            btnPlay.title =
                'Executando';

            btnPlay.style.setProperty(
                '--accent',
                '#00e5ff'
            );

            btnPlay.disabled =
                true;

            btnPause.disabled =
                false;

            btnStop.disabled =
                false;

            spanContador.innerText =
                '0';

            atualizarStatus(
                `▶️ Iniciando ${totalDesejado}`,
                '#00e5ff',
                true
            );

            // =================================================
            // EXECUÇÃO
            // =================================================

            for (
                let i = 0;
                i < totalDesejado;
                i++
            ) {
                if (parar) {
                    atualizarStatus(
                        '⏹️ Parado',
                        '#ff1744'
                    );

                    break;
                }

                while (pausado) {
                    atualizarStatus(
                        '⏸️ Pausado',
                        '#ffab00'
                    );

                    await delay(
                        1000
                    );

                    if (parar) {
                        break;
                    }
                }

                if (parar) {
                    break;
                }

                const sucesso =
                    await executarApropriacao();

                if (sucesso) {
                    contador++;

                    spanContador.innerText =
                        contador;

                    atualizarStatus(
                        `✅ ${contador}/${totalDesejado}`,
                        '#00e676',
                        true
                    );
                } else {
                    atualizarStatus(
                        '❌ Falha',
                        '#ff1744'
                    );

                    break;
                }

                if (
                    i <
                    totalDesejado - 1
                ) {
                    await delay(
                        DELAY_ENTRE_LOOPS
                    );
                }
            }

            // =================================================
            // FINALIZAÇÃO
            // =================================================

            executando =
                false;

            pausado =
                false;

            btnPlay.innerText =
                '▶';

            btnPlay.title =
                'Iniciar';

            btnPlay.style.setProperty(
                '--accent',
                '#00e676'
            );

            btnPlay.disabled =
                false;

            btnPause.innerText =
                'Ⅱ';

            btnPause.title =
                'Pausar';

            btnPause.disabled =
                true;

            btnStop.disabled =
                true;

            if (!parar) {
                atualizarStatus(
                    `🏁 ${contador} concluídos`,
                    '#00e676'
                );
            }
        }

        // =====================================================
        // PLAY
        // =====================================================

        btnPlay.addEventListener(
            'click',
            () => {
                if (!executando) {
                    executarLoop();
                }
            }
        );

        // =====================================================
        // PAUSE / RETOMAR
        // =====================================================

        btnPause.addEventListener(
            'click',
            () => {
                if (
                    executando &&
                    !pausado
                ) {
                    pausado =
                        true;

                    btnPause.innerText =
                        '▶';

                    btnPause.title =
                        'Retomar';

                    atualizarStatus(
                        '⏸️ Pausado',
                        '#ffab00'
                    );
                }

                else if (
                    executando &&
                    pausado
                ) {
                    pausado =
                        false;

                    btnPause.innerText =
                        'Ⅱ';

                    btnPause.title =
                        'Pausar';

                    atualizarStatus(
                        '▶️ Retomando...',
                        '#00e5ff',
                        true
                    );
                }
            }
        );

        // =====================================================
        // STOP
        // =====================================================

        btnStop.addEventListener(
            'click',
            () => {
                if (executando) {
                    parar =
                        true;

                    pausado =
                        false;

                    atualizarStatus(
                        '⏹️ Parando...',
                        '#ff1744',
                        true
                    );

                    btnPause.innerText =
                        'Ⅱ';

                    btnPause.title =
                        'Pausar';
                }
            }
        );

        // =====================================================
        // ATUALIZAR
        // =====================================================

        btnRefresh.addEventListener(
            'click',
            () => {
                atualizarListagem();
            }
        );

        // =====================================================
        // ENTER NO INPUT
        // =====================================================

        inputLoop.addEventListener(
            'keydown',
            e => {
                if (
                    e.key ===
                    'Enter'
                ) {
                    btnPlay.click();
                }
            }
        );

        // =====================================================
        // ARRASTAR
        // =====================================================

        let arrastando =
            false;

        let cliqueX =
            0;

        let cliqueY =
            0;

        painel.addEventListener(
            'mousedown',
            e => {
                if (
                    e.target.closest(
                        'button'
                    ) ||
                    e.target.closest(
                        'input'
                    )
                ) {
                    return;
                }

                arrastando =
                    true;

                cliqueX =
                    e.clientX -
                    painel.offsetLeft;

                cliqueY =
                    e.clientY -
                    painel.offsetTop;
            }
        );

        document.addEventListener(
            'mousemove',
            e => {
                if (
                    !arrastando
                ) {
                    return;
                }

                painel.style.left =
                    (
                        e.clientX -
                        cliqueX
                    ) + 'px';

                painel.style.top =
                    (
                        e.clientY -
                        cliqueY
                    ) + 'px';

                painel.style.bottom =
                    'auto';
            }
        );

        document.addEventListener(
            'mouseup',
            () => {
                arrastando =
                    false;
            }
        );

        // =====================================================
        // ATUALIZA A LISTAGEM COP ENCERRAMENTOS
        // =====================================================

        function atualizarListagem() {
            const teamSelect =
                  document.querySelector(
                      '#team-select'
                  );

            if (!teamSelect) {
                atualizarStatus(
                    '❌ Filtro de equipe não encontrado',
                    '#ff1744'
                );

                return;
            }

            // Define COP Encerramentos
            teamSelect.value = '1009';

            // O OSIR utiliza bastante jQuery nessa interface.
            // Se estiver disponível, usamos o próprio mecanismo dele.
            if (window.jQuery) {
                window.jQuery(teamSelect)
                    .val('1009')
                    .trigger('change');
            } else {
                // Fallback caso jQuery não esteja disponível
                teamSelect.dispatchEvent(
                    new Event(
                        'input',
                        {
                            bubbles: true
                        }
                    )
                );

                teamSelect.dispatchEvent(
                    new Event(
                        'change',
                        {
                            bubbles: true
                        }
                    )
                );
            }

            atualizarStatus(
                '↻ Atualizando...',
                '#00e5ff',
                true
            );

            // Volta o indicador para verde
            // depois que a atualização tiver sido disparada.
            setTimeout(() => {
                atualizarStatus(
                    '🟢 Atualizado',
                    '#00e676'
                );
            }, 1200);
        }

        // =====================================================
        // ADICIONA O PAINEL
        // =====================================================

        document.body.appendChild(
            painel
        );

        console.log(
            '✅ Painel futurista criado!'
        );

        console.log(
            `⏱️ Delays: ` +
            `${DELAYS.APOS_SELECIONAR / 1000}s / ` +
            `${DELAYS.APOS_CLICAR / 1000}s / ` +
            `${DELAYS.APOS_CONFIRMAR / 1000}s`
        );

        console.log(
            `⏱️ Entre loops: ` +
            `${DELAY_ENTRE_LOOPS / 1000}s`
        );
    }

    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    iniciarPainel();

    const observador =
        new MutationObserver(
            () => {
                iniciarPainel();
            }
        );

    observador.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );

})();
