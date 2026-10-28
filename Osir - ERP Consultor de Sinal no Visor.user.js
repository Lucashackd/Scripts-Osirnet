// ==UserScript==
// @name         Osir - ERP Consultor de Sinal no Visor
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      2.9.0
// @description  Consulta a potência RX no Visor OSIR, compara o ponto de acesso e permite cópia manual
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

    const REQUEST_KEY = 'osir_visor_rx_request_v281';
    const RESULT_KEY = 'osir_visor_rx_result_v281';
    const NOTICE_DURATION = 15000;
    const LOOKUP_TIMEOUT_MS = 30000;
    const POLL_INTERVAL_MS = 500;
    const RX_MIN = -25.08;
    const RX_MAX = -13;


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
    // FUNÇÕES COMPARTILHADAS
    // =====================================================================

    function normalizarTexto(texto) {
        return String(texto ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    function traduzirAccessPoint(rawText) {
        if (!rawText || !String(rawText).trim()) return '';

        let cleaned = String(rawText).trim();
        cleaned = cleaned.replace(/^Fibra\s+/i, '');

        let previous;
        do {
            previous = cleaned;
            cleaned = cleaned.replace(/\s+Dedicados$/i, '');
            cleaned = cleaned.replace(/\s+Slot\s+\d+\s+Porta\s+\d+$/i, '');
            cleaned = cleaned.trim();
        } while (cleaned !== previous);

        if (!cleaned) return '';

        const mapped = MAPA_OLT[cleaned] || MAPA_OLT[cleaned.toUpperCase()];
        if (mapped) return mapped;

        if (!/^OLT\s/i.test(cleaned) && !/^OTL\s/i.test(cleaned)) {
            return `OLT ${cleaned}`;
        }

        return cleaned;
    }

    function setNativeInputValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
        )?.set;

        if (!setter || !input) return;

        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function extrairSlotPortaERP(texto) {
        const raw = String(texto || '');
        const labeled = raw.match(/\bSlot\s*(\d+)\s*[,;\-]?\s*Porta\s*(\d+)\b/i);

        if (labeled) {
            return {
                slot: Number(labeled[1]),
                porta: Number(labeled[2]),
                texto: `Slot ${labeled[1]} / Porta ${labeled[2]}`
            };
        }

        const path = raw.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);

        if (path) {
            const numbers = [
                Number(path[1]),
                Number(path[2]),
                Number(path[3])
            ];

            return {
                slot: numbers[numbers.length - 2],
                porta: numbers[numbers.length - 1],
                texto: `Slot ${numbers[numbers.length - 2]} / Porta ${numbers[numbers.length - 1]}`
            };
        }

        return null;
    }

    function extrairSlotPortaPon(texto) {
        const numbers = String(texto || '').match(/\d+/g)?.map(Number) || [];

        if (numbers.length < 2) return null;

        const slot = numbers[numbers.length - 2];
        const porta = numbers[numbers.length - 1];

        return {
            slot,
            porta,
            texto: `Slot ${slot} / Porta ${porta}`
        };
    }

    function normalizarNomeOlt(nome) {
        return normalizarTexto(nome)
            .replace(/^(OLT|OTL)\s*/, '')
            .replace(/[\s_\-]+/g, '');
    }

    function parseRx(rx) {
        const cleaned = String(rx ?? '')
            .replace(/,/g, '.')
            .replace(/[^\d.+-]/g, '');

        const value = Number(cleaned);

        return Number.isFinite(value) ? value : null;
    }

    // =====================================================================
    // LÓGICA DO VISOR
    // =====================================================================

    if (window.location.hostname === 'visor.osir.net.br') {
        console.log('[RX AUTOMATION] Visor OSIR detectado.');

        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        let intervalAtual = null;

        async function esperarElemento(getElement, timeout = 10000, intervalo = 100) {
            const inicio = Date.now();
            while (Date.now() - inicio < timeout) {
                const element = getElement();
                if (element) return element;
                await sleep(intervalo);
            }
            return null;
        }

        function enviarResultado(requestId, dados) {
            GM_setValue(RESULT_KEY, JSON.stringify({
                ...dados,
                requestId,
                timestamp: Date.now()
            }));
        }

        function enviarErro(requestId, mensagem) {
            enviarResultado(requestId, {
                tipo: 'erro',
                mensagem: `ERRO: ${mensagem}`
            });
        }

        function encontrarContainerModoConsulta() {
            return document.querySelector('div.relative.grid.grid-cols-2');
        }

        function encontrarBotaoModoOlt() {
            const container = encontrarContainerModoConsulta();
            if (!container) return null;
            const buttons = Array.from(container.querySelectorAll('button[type="button"]'));
            return buttons.find(btn => normalizarTexto(btn.textContent) === 'OLT') || buttons[1] || null;
        }

        function encontrarBotaoModoCidade() {
            const container = encontrarContainerModoConsulta();
            if (!container) return null;
            const buttons = Array.from(container.querySelectorAll('button[type="button"]'));
            return buttons.find(btn => normalizarTexto(btn.textContent) === 'CIDADE') || buttons[0] || null;
        }

        function encontrarBotaoConsultar() {
            const buttons = Array.from(document.querySelectorAll('button[type="submit"]'));
            return buttons.find(btn => btn.offsetParent !== null) || buttons[0] || null;
        }

        function encontrarSeletorOlt() {
            const candidates = Array.from(document.querySelectorAll('div.fade-swap > div.relative > button[type="button"]'));
            return candidates.find(btn => {
                const text = normalizarTexto(btn.textContent);
                return text === 'SELECIONE UMA OLT' ||
                    text.startsWith('OLT ') ||
                    text.startsWith('OTL ') ||
                    text === 'RG_QNT';
            }) || null;
        }

        function encontrarInputSerial(serialPreferencial = '') {
            const inputs = Array.from(document.querySelectorAll('input')).filter(
                input => input.getAttribute('placeholder') !== 'Buscar OLT...'
            );

            const identificados = inputs.filter(input => {
                const description = normalizarTexto([
                    input.id, input.name, input.placeholder, input.getAttribute('aria-label')
                ].filter(Boolean).join(' '));
                return description.includes('SERIAL');
            });

            if (serialPreferencial) {
                const match = identificados.find(
                    input => normalizarTexto(input.value) === normalizarTexto(serialPreferencial)
                );
                if (match) return match;
            }

            return identificados.find(input => input.offsetParent !== null) ||
                identificados[0] ||
                inputs.find(input => input.offsetParent !== null) ||
                inputs[0] || null;
        }

        function encontrarCampoPorRotulo(card, labels) {
            if (!card) return '';
            const accepted = new Set(labels.map(normalizarTexto));
            const paragraphs = Array.from(card.querySelectorAll('p'));

            for (const label of paragraphs) {
                if (!accepted.has(normalizarTexto(label.textContent))) continue;
                const container = label.closest('div.px-5.py-4') || label.parentElement;
                if (!container) continue;
                const valueParagraph = Array.from(container.querySelectorAll('p')).find(
                    p => p !== label && p.textContent.trim()
                );
                if (valueParagraph) return valueParagraph.textContent.trim();
            }
            return '';
        }

        // Lê o nome da OLT no item do resultado: <span>OLT</span><span>OLT RG_PQM</span>
        function encontrarOltDoResultado(card) {
            for (const root of [card, document]) {
                if (!root) continue;
                const spans = Array.from(root.querySelectorAll('.result-item span'));
                const rotulo = spans.find(span => normalizarTexto(span.textContent) === 'OLT');
                if (!rotulo) continue;

                let valor = rotulo.nextElementSibling;
                while (valor && valor.tagName !== 'SPAN') valor = valor.nextElementSibling;

                const texto = valor?.textContent?.trim();
                if (texto) return texto;
            }
            return '';
        }

        // Badge de alarme de sinal (ex.: "LOSi/LOBi"), exibido no lugar de um sinal válido
        function encontrarAlarmeSinal(serial) {
            const badges = Array.from(document.querySelectorAll('span.rounded-full')).filter(span =>
                /^LO[SB]/.test(normalizarTexto(span.textContent))
            );

            for (const badge of badges) {
                const card = badge.closest('.result-pop') || badge.closest('main') || document.body;
                if (normalizarTexto(card.textContent).includes(normalizarTexto(serial))) {
                    return { texto: badge.textContent.replace(/\s+/g, ' ').trim(), card };
                }
            }
            return null;
        }

        function encontrarCardResultado(serial) {
            const rxLabels = Array.from(document.querySelectorAll('span')).filter(
                span => normalizarTexto(span.textContent) === 'POTÊNCIA RX'
            );

            for (const rxLabel of rxLabels) {
                const card = rxLabel.closest('.result-pop') || rxLabel.closest('main') || document.body;
                if (normalizarTexto(card.textContent).includes(normalizarTexto(serial))) {
                    return { rxLabel, card };
                }
            }
            return null;
        }

        function encontrarAvisosOntNaoEncontrada() {
            let avisoOlt = null, avisoCidade = null;
            for (const div of Array.from(document.querySelectorAll('div'))) {
                const text = normalizarTexto(div.textContent);
                if (text === 'ONT NÃO ENCONTRADA NESTA OLT') avisoOlt = div;
                if (text === 'ONT NÃO ENCONTRADA EM NENHUMA OLT') avisoCidade = div;
            }
            return { olt: avisoOlt, cidade: avisoCidade };
        }

        async function selecionarOlt(olt) {
            const desired = normalizarTexto(olt);
            if (!desired) throw new Error('OLT recebida está vazia');

            const selector = await esperarElemento(encontrarSeletorOlt, 10000);
            if (!selector) throw new Error('Seletor de OLT não encontrado');
            if (normalizarTexto(selector.textContent) === desired) return;

            selector.click();
            const wrapper = selector.parentElement;

            const searchInput = await esperarElemento(
                () => wrapper?.querySelector('input[placeholder="Buscar OLT..."]'), 5000
            );

            if (!searchInput) throw new Error('Campo de busca da OLT não encontrado');

            searchInput.focus();
            setNativeInputValue(searchInput, olt);
            await sleep(250);

            for (const eventType of ['keydown', 'keyup']) {
                searchInput.dispatchEvent(new KeyboardEvent(eventType, {
                    key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true
                }));
            }

            const option = await esperarElemento(() => {
                const options = Array.from(wrapper?.querySelectorAll('button[data-index]') || []);
                return options.find(btn => normalizarTexto(btn.textContent) === desired) || (options.length === 1 ? options[0] : null);
            }, 5000, 100);

            if (!option) throw new Error(`OLT não encontrada na lista: ${olt}`);
            option.click();

            const selected = await esperarElemento(() => {
                const current = encontrarSeletorOlt();
                return current && normalizarTexto(current.textContent) === desired ? current : null;
            }, 5000, 100);

            if (!selected) throw new Error(`Falha ao confirmar a seleção da OLT: ${olt}`);
        }

        async function preencherSerial(serial) {
            const input = await esperarElemento(() => encontrarInputSerial(serial), 10000);
            if (!input) throw new Error('Input do serial não encontrado');
            input.focus();
            setNativeInputValue(input, serial);
            await sleep(300);
            return input;
        }

        async function executarConsultaCidade(serial, requestId, marcarOltDiferente, motivo) {
            const cityButton = await esperarElemento(encontrarBotaoModoCidade, 10000);
            if (!cityButton) {
                enviarErro(requestId, 'Botão do modo Cidade não encontrado');
                return;
            }

            cityButton.click();
            await sleep(500);
            await preencherSerial(serial);

            const submit = await esperarElemento(encontrarBotaoConsultar, 10000);
            if (!submit) {
                enviarErro(requestId, 'Botão Consultar não encontrado');
                return;
            }

            submit.disabled = false;
            submit.click();

            aguardarResultado(serial, requestId, true, marcarOltDiferente);
        }

        GM_addValueChangeListener(REQUEST_KEY, async function (name, oldValue, rawData, remote) {
            if (!remote || !rawData) return;
            let request;
            try {
                request = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            } catch (error) { return; }

            const serial = String(request?.serial || '').trim();
            const olt = String(request?.olt || '').trim();
            const requestId = String(request?.requestId || request?.timestamp || Date.now());

            clearInterval(intervalAtual);

            if (!serial) {
                enviarErro(requestId, 'Serial não informado');
                return;
            }

            try {
                if (!document.body) await esperarElemento(() => document.body, 10000);
                await esperarElemento(() => encontrarContainerModoConsulta() || encontrarBotaoConsultar() || encontrarInputSerial(serial), 15000);

                if (!olt) {
                    await executarConsultaCidade(serial, requestId, false, 'Ponto de acesso vazio no ERP');
                    return;
                }

                const oltButton = await esperarElemento(encontrarBotaoModoOlt, 10000);
                if (!oltButton) throw new Error('Botão do modo OLT não encontrado');

                oltButton.click();
                await sleep(300);
                await selecionarOlt(olt);
                await preencherSerial(serial);

                const submit = await esperarElemento(encontrarBotaoConsultar, 10000);
                if (!submit) throw new Error('Botão Consultar não encontrado');

                submit.disabled = false;
                submit.click();

                aguardarResultado(serial, requestId, false, false);
            } catch (error) {
                enviarErro(requestId, error?.message || 'Falha ao processar consulta');
            }
        });

        function aguardarResultado(serial, requestId, consultaPorCidade, marcarOltDiferente) {
            // Garante um único monitoramento ativo (sem timeout na Cidade, não pode haver sobras)
            clearInterval(intervalAtual);

            const inicio = Date.now();
            let finalizado = false;

            const interval = setInterval(() => {
                if (finalizado) {
                    clearInterval(interval);
                    return;
                }

                try {
                    const avisos = encontrarAvisosOntNaoEncontrada();

                    if (consultaPorCidade && avisos.cidade) {
                        finalizado = true;
                        clearInterval(interval);
                        enviarErro(requestId, 'ONT não encontrada');
                        return;
                    }

                    if (!consultaPorCidade && avisos.olt) {
                        finalizado = true;
                        clearInterval(interval);
                        executarConsultaCidade(serial, requestId, true, 'ONT não encontrada nesta OLT').catch(() => {
                            enviarErro(requestId, 'Falha ao consultar por Cidade');
                        });
                        return;
                    }

                    const alarme = encontrarAlarmeSinal(serial);
                    const result = encontrarCardResultado(serial);
                    const rxContainer = result?.rxLabel.parentElement?.querySelector('.text-2xl');

                    if (alarme || rxContainer) {
                        finalizado = true;
                        clearInterval(interval);

                        setTimeout(() => {
                            // Relê tudo: o alarme tem prioridade sobre qualquer valor de RX exibido
                            const alarmeFinal = encontrarAlarmeSinal(serial) || alarme;
                            const latest = encontrarCardResultado(serial);
                            const card = latest?.card || alarmeFinal?.card;
                            const currentRx = latest?.rxLabel.parentElement?.querySelector('.text-2xl')?.textContent?.trim() || '';
                            const ponPort = encontrarCampoPorRotulo(card, ['PORTA PON']);
                            const oltVisor = encontrarOltDoResultado(card) ||
                                encontrarCampoPorRotulo(card, ['OLT', 'NOME DA OLT', 'NOME OLT', 'OLT NAME']);

                            if (!alarmeFinal && !currentRx) {
                                enviarErro(requestId, 'Valor RX em branco');
                                return;
                            }

                            enviarResultado(requestId, {
                                tipo: 'sucesso',
                                rx: currentRx,
                                alarme: alarmeFinal ? alarmeFinal.texto : '',
                                oltDiferente: Boolean(marcarOltDiferente),
                                oltVisor: oltVisor || '',
                                portaPon: ponPort || '',
                                consultaPorCidade: Boolean(consultaPorCidade)
                            });
                        }, 1000);
                        return;
                    }
                } catch (error) {
                    finalizado = true;
                    clearInterval(interval);
                    enviarErro(requestId, 'Falha na leitura do resultado');
                    return;
                }

                // O timeout vale só para a busca por OLT: ao estourar, cai para a busca por Cidade.
                // A busca por Cidade não tem timeout: aguarda até o Visor responder
                // (resultado, "ONT não encontrada" ou erro de leitura).
                if (!consultaPorCidade && Date.now() - inicio >= LOOKUP_TIMEOUT_MS) {
                    finalizado = true;
                    clearInterval(interval);
                    executarConsultaCidade(serial, requestId, true, 'Timeout').catch(() => {
                        enviarErro(requestId, 'Falha ao consultar por Cidade');
                    });
                }
            }, POLL_INTERVAL_MS);

            intervalAtual = interval;
        }
        return;
    }

    // =====================================================================
    // LÓGICA DO ERP
    // =====================================================================

    const BUTTON_ID = 'tm-visor-rx-button-v281';
    const ALERT_ID = 'tm-visor-rx-result-alert-v282';
    const STYLE_ID = 'tm-visor-rx-styles-v290';
    const ALERT_DURATION = 10000;

    let currentRequest = null;

    // =====================================================================
    // DESIGN SYSTEM
    // Toda a aparência vive aqui. A lógica abaixo só alterna classes/atributos.
    //
    // Paleta
    //   --osir-navy-900  #0e1140  fundo do card
    //   --osir-navy-700  #1c2064  marca (botão de cópia, hover)
    //   --osir-green     #42a047  ação principal / sucesso
    //   --osir-amber     #f9cf0c  atenção / divergência
    //   --osir-mist      branco em baixa opacidade para texto secundário
    // =====================================================================

    const ESTILOS = `
        :root {
            --osir-navy-900: #0e1140;
            --osir-navy-800: #151952;
            --osir-navy-700: #1c2064;
            --osir-green: #42a047;
            --osir-green-soft: #5fd068;
            --osir-amber: #f9cf0c;
            --osir-red: #ff7b7b;
            --osir-ink: #0a0c2b;
            --osir-text: #f4f5ff;
            --osir-text-dim: rgba(244, 245, 255, 0.66);
            --osir-line: rgba(255, 255, 255, 0.09);
            --osir-ease: cubic-bezier(0.22, 1, 0.36, 1);
        }

        /* ---------- Botão de consulta ---------- */

        .osir-rx-btn {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            flex-shrink: 0;
            align-self: center;
            height: 40px;
            min-width: 44px;
            margin-left: 10px;
            padding: 0 14px;
            border: 0;
            border-radius: 10px;
            background: linear-gradient(180deg, #4cb051 0%, var(--osir-green) 100%);
            color: #ffffff;
            font: inherit;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.01em;
            white-space: nowrap;
            cursor: pointer;
            box-shadow:
                0 1px 0 rgba(255, 255, 255, 0.28) inset,
                0 -1px 0 rgba(0, 0, 0, 0.12) inset,
                0 4px 10px -2px rgba(66, 160, 71, 0.45);
            transition:
                background 0.25s var(--osir-ease),
                color 0.25s var(--osir-ease),
                box-shadow 0.25s var(--osir-ease),
                transform 0.18s var(--osir-ease);
        }

        .osir-rx-btn svg { flex-shrink: 0; display: block; }

        .osir-rx-btn:hover {
            background: linear-gradient(180deg, #262b7a 0%, var(--osir-navy-700) 100%);
            box-shadow:
                0 1px 0 rgba(255, 255, 255, 0.16) inset,
                0 6px 16px -4px rgba(28, 32, 100, 0.6);
            transform: translateY(-1px);
        }

        .osir-rx-btn:active { transform: translateY(0) scale(0.97); }

        .osir-rx-btn:focus-visible {
            outline: 2px solid var(--osir-amber);
            outline-offset: 2px;
        }

        /* Carregando */
        .osir-rx-btn[data-loading="true"] {
            background: var(--osir-navy-700);
            color: #ffffff;
            cursor: progress;
            transform: none;
            box-shadow: 0 4px 12px -4px rgba(28, 32, 100, 0.55);
        }

        .osir-rx-spinner {
            display: block;
            flex: 0 0 18px;
            box-sizing: border-box;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 2.5px solid rgba(255, 255, 255, 0.22);
            border-top-color: var(--osir-amber);
            will-change: transform;
            animation: osir-rx-spin 0.8s linear infinite !important;
        }

        /* Aviso (erro ou divergência) */
        .osir-rx-btn[data-notice-active="true"] {
            background: linear-gradient(180deg, #ffdc3a 0%, var(--osir-amber) 100%);
            color: var(--osir-ink);
            box-shadow:
                0 1px 0 rgba(255, 255, 255, 0.5) inset,
                0 4px 12px -2px rgba(249, 207, 12, 0.5);
            transform: none;
        }

        .osir-rx-btn[data-notice-active="true"]:hover {
            background: linear-gradient(180deg, #ffe35c 0%, #f4c800 100%);
        }

        /* ---------- Cópia do sinal (dentro do alerta) ---------- */

        .osir-rx-copy-mini {
            display: grid;
            place-items: center;
            align-self: center;
            width: 24px;
            height: 24px;
            margin-left: 4px;
            padding: 0;
            border: 0;
            border-radius: 7px;
            background: transparent;
            color: var(--osir-text-dim);
            cursor: pointer;
            transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease;
        }

        .osir-rx-copy-mini svg { width: 14px; height: 14px; display: block; }
        .osir-rx-copy-mini:hover { background: rgba(255, 255, 255, 0.10); color: #ffffff; }
        .osir-rx-copy-mini:active { transform: scale(0.9); }
        .osir-rx-copy-mini:focus-visible { outline: 2px solid var(--osir-amber); outline-offset: 1px; }
        .osir-rx-copy-mini[data-state="copied"] { color: var(--osir-green-soft); }
        .osir-rx-copy-mini[data-state="failed"] { color: var(--osir-red); }

        /* ---------- Alerta de resultado ---------- */

        .osir-rx-alert {
            position: fixed;
            top: 12px;
            left: 50%;
            z-index: 2147483647;
            width: min(330px, calc(100vw - 24px));
            max-height: calc(100vh - 40px);
            overflow: auto;
            box-sizing: border-box;
            transform: translateX(-50%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: var(--osir-text);
            animation: osir-rx-enter 0.5s var(--osir-ease) both;
        }

        .osir-rx-alert[data-leaving="true"] {
            animation: osir-rx-leave 0.3s ease-in both;
            pointer-events: none;
        }

        .osir-rx-alert *, .osir-rx-alert *::before, .osir-rx-alert *::after {
            box-sizing: border-box;
        }

        .osir-rx-card {
            position: relative;
            overflow: hidden;
            border-radius: 13px;
            background:
                radial-gradient(120% 90% at 0% 0%, rgba(66, 160, 71, 0.10) 0%, transparent 55%),
                linear-gradient(180deg, var(--osir-navy-800) 0%, var(--osir-navy-900) 100%);
            border: 1px solid rgba(255, 255, 255, 0.10);
            box-shadow:
                0 1px 0 rgba(255, 255, 255, 0.08) inset,
                0 24px 48px -12px rgba(5, 7, 32, 0.65),
                0 8px 16px -8px rgba(5, 7, 32, 0.5);
        }

        .osir-rx-card[data-tone="ok"] { --tone: var(--osir-green-soft); }
        .osir-rx-card[data-tone="bad"] { --tone: var(--osir-red); }

        /* Cabeçalho */
        .osir-rx-head {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 11px 10px 9px 13px;
        }

        .osir-rx-head-mark {
            flex: 0 0 28px;
            width: 28px;
            height: 28px;
            display: grid;
            place-items: center;
            border-radius: 9px;
            color: var(--osir-ink);
            background: var(--tone, var(--osir-amber));
            box-shadow: 0 6px 16px -4px color-mix(in srgb, var(--tone, #f9cf0c) 60%, transparent);
        }

        .osir-rx-head-mark svg { display: block; }

        .osir-rx-head-text { flex: 1; min-width: 0; }

        .osir-rx-title {
            margin: 0;
            font-size: 13.5px;
            font-weight: 650;
            line-height: 1.25;
            letter-spacing: -0.005em;
            color: var(--osir-text);
        }

        .osir-rx-subtitle {
            margin: 1px 0 0;
            font-size: 11px;
            line-height: 1.3;
            color: var(--osir-text-dim);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .osir-rx-close {
            flex: 0 0 24px;
            width: 24px;
            height: 24px;
            display: grid;
            place-items: center;
            padding: 0;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: var(--osir-text-dim);
            cursor: pointer;
            transition: background 0.2s ease, color 0.2s ease;
        }

        .osir-rx-close:hover { background: rgba(255, 255, 255, 0.10); color: #ffffff; }
        .osir-rx-close:focus-visible { outline: 2px solid var(--osir-amber); outline-offset: 1px; }

        /* Corpo */
        .osir-rx-body { padding: 0 13px 2px; }

        .osir-rx-row {
            padding: 9px 0;
            border-top: 1px solid var(--osir-line);
            animation: osir-rx-row 0.5s var(--osir-ease) both;
        }

        .osir-rx-row:nth-child(2) { animation-delay: 0.08s; }
        .osir-rx-row:nth-child(3) { animation-delay: 0.16s; }

        .osir-rx-row-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .osir-rx-label {
            font-size: 12.5px;
            font-weight: 600;
            color: var(--osir-text);
        }

        .osir-rx-status {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 2px 8px 2px 6px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            line-height: 1.4;
            white-space: nowrap;
        }

        .osir-rx-status svg { display: block; flex-shrink: 0; }

        .osir-rx-status[data-state="ok"] {
            color: var(--osir-green-soft);
            background: rgba(95, 208, 104, 0.14);
        }

        .osir-rx-status[data-state="fail"] {
            color: var(--osir-red);
            background: rgba(255, 123, 123, 0.16);
        }

        .osir-rx-status[data-state="unknown"] {
            color: var(--osir-text-dim);
            background: rgba(255, 255, 255, 0.08);
        }

        .osir-rx-detail {
            margin: 4px 0 0;
            font-size: 11.5px;
            line-height: 1.4;
            color: var(--osir-text-dim);
            overflow-wrap: anywhere;
        }

        /* Valor RX em destaque */
        .osir-rx-value {
            display: flex;
            align-items: baseline;
            gap: 5px;
            margin-top: 4px;
            font-variant-numeric: tabular-nums;
        }

        .osir-rx-value strong {
            font-size: 22px;
            font-weight: 700;
            line-height: 1;
            letter-spacing: -0.02em;
            color: var(--osir-text);
        }

        .osir-rx-value[data-state="ok"] strong { color: var(--osir-green-soft); }
        .osir-rx-value[data-state="fail"] strong { color: var(--osir-red); }

        .osir-rx-value span {
            font-size: 11px;
            color: var(--osir-text-dim);
        }

        /* Mensagem de erro */
        .osir-rx-error {
            margin: 2px 0 10px;
            padding: 8px 11px;
            border-radius: 10px;
            background: rgba(249, 207, 12, 0.10);
            border: 1px solid rgba(249, 207, 12, 0.35);
            color: var(--osir-amber);
            font-size: 12px;
            font-weight: 600;
            line-height: 1.35;
        }

        /* Barra de tempo restante */
        .osir-rx-timer {
            height: 2px;
            background: rgba(255, 255, 255, 0.06);
        }

        .osir-rx-timer-fill {
            height: 100%;
            background: var(--tone, var(--osir-amber));
            transform-origin: left center;
            animation: osir-rx-timer linear forwards;
        }

        .osir-rx-alert:hover .osir-rx-timer-fill,
        .osir-rx-alert:focus-within .osir-rx-timer-fill {
            animation-play-state: paused;
        }

        /* ---------- Animações ---------- */

        @keyframes osir-rx-spin { to { transform: rotate(360deg); } }

        @keyframes osir-rx-enter {
            from { opacity: 0; transform: translate(-50%, -16px) scale(0.98); }
            to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }

        @keyframes osir-rx-leave {
            from { opacity: 1; transform: translate(-50%, 0) scale(1); }
            to   { opacity: 0; transform: translate(-50%, -12px) scale(0.98); }
        }

        @keyframes osir-rx-row {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: none; }
        }

        @keyframes osir-rx-timer {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
            .osir-rx-btn, .osir-rx-alert, .osir-rx-row {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
    `;

    function injetarEstilos() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = ESTILOS;
        (document.head || document.documentElement).appendChild(style);
    }

    // =====================================================================
    // ÍCONES
    // =====================================================================

    const svg = (size, stroke, body) => `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>
    `;

    const ICONS = {
        eye: svg(19, 2.2, '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
        copy: svg(16, 2.2, '<rect width="13" height="13" x="9" y="9" rx="2.5"/><path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2"/>'),
        check: svg(14, 3, '<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
        cross: svg(14, 3, '<path d="M6 6l12 12M18 6L6 18"/>'),
        help: svg(14, 2.6, '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2-2.4 3.5"/><path d="M12 17.2h.01"/>'),
        alert: svg(15, 2.4, '<path d="M12 3.5 2.8 19.5h18.4L12 3.5Z"/><path d="M12 10v4.2"/><path d="M12 17.4h.01"/>'),
        signal: svg(16, 2.5, '<path d="M4 19v-3"/><path d="M9 19v-7"/><path d="M14 19V8"/><path d="M19 19V4"/>'),
        close: svg(13, 2.4, '<path d="M6 6l12 12M18 6L6 18"/>')
    };

    // =====================================================================
    // BOTÃO DE CONSULTA (estados)
    // =====================================================================

    function cancelarTimerAviso(btn) {
        if (btn._rxNoticeTimer) {
            clearTimeout(btn._rxNoticeTimer);
            btn._rxNoticeTimer = null;
        }
    }

    function limparEstadoAviso(btn) {
        cancelarTimerAviso(btn);
        delete btn.dataset.noticeActive;
        delete btn.dataset.noticeType;
        delete btn.dataset.differentOlt;
    }

    function setButtonDefaultState(btn) {
        limparEstadoAviso(btn);
        delete btn.dataset.loading;

        btn.innerHTML = ICONS.eye;
        btn.title = 'Consultar potência RX no Visor OSIR';
        btn.setAttribute('aria-label', 'Consultar potência RX no Visor OSIR');
    }

    function setButtonLoadingState(btn) {
        limparEstadoAviso(btn);
        btn.dataset.loading = 'true';
        btn.innerHTML = '<span class="osir-rx-spinner" role="status" aria-label="Consultando"></span>';
        const spinner = btn.querySelector('.osir-rx-spinner');
        if (spinner && typeof spinner.animate === 'function') {
            spinner.animate(
                [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
                { duration: 800, iterations: Infinity, easing: 'linear' }
            );
        }
        btn.title = 'Consultando...';
    }

    function mostrarAvisoNoBotao(btn, texto, tipo) {
        limparEstadoAviso(btn);
        delete btn.dataset.loading;

        btn.dataset.noticeActive = 'true';
        btn.dataset.noticeType = tipo;
        if (tipo !== 'error') btn.dataset.differentOlt = 'true';

        btn.innerHTML = ICONS.alert;
        const label = document.createElement('span');
        label.textContent = texto;
        btn.appendChild(label);
        btn.title = texto;

        btn._rxNoticeTimer = setTimeout(() => {
            if (btn.isConnected && !btn.dataset.loading && btn.dataset.noticeActive === 'true') {
                setButtonDefaultState(btn);
            }
        }, NOTICE_DURATION);
    }

    function setButtonErrorState(btn, message) {
        mostrarAvisoNoBotao(btn, message, 'error');
    }

    function setButtonDifferentPointState(btn, message) {
        mostrarAvisoNoBotao(btn, message || 'Ponto de Acesso diferente', 'different-olt');
    }

    // =====================================================================
    // CÓPIA PARA A ÁREA DE TRANSFERÊNCIA
    // =====================================================================

    async function copiarTextoManual(texto) {
        if (!texto) return false;
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(texto);
            return true;
        }
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        textarea.remove();
        return success;
    }

    // =====================================================================
    // ALERTA: HELPERS DE DOM
    // =====================================================================

    function criarElemento(tag, text, className) {
        const element = document.createElement(tag);
        if (text !== undefined && text !== null) element.textContent = text;
        if (className) element.className = className;
        return element;
    }

    function criarStatus(estado, texto) {
        const icone = estado === 'ok' ? ICONS.check : estado === 'fail' ? ICONS.cross : ICONS.help;
        const status = criarElemento('span', null, 'osir-rx-status');
        status.dataset.state = estado;
        status.innerHTML = icone;
        status.appendChild(document.createTextNode(texto));
        return status;
    }

    function estadoDaLinha(ok, unknown) {
        if (ok) return 'ok';
        return unknown ? 'unknown' : 'fail';
    }

    function textoDoEstado(estado, textos) {
        if (estado === 'ok') return textos?.ok || 'Verificado';
        if (estado === 'unknown') return 'Sem confirmação';
        return textos?.fail || 'Divergência';
    }

    function criarLinhaAlerta(container, label, ok, detail, unknown = false, extra = null, textos = null) {
        const estado = estadoDaLinha(ok, unknown);

        const row = criarElemento('div', null, 'osir-rx-row');
        const top = criarElemento('div', null, 'osir-rx-row-top');
        top.appendChild(criarElemento('span', label, 'osir-rx-label'));
        top.appendChild(criarStatus(estado, textoDoEstado(estado, textos)));
        row.appendChild(top);

        if (extra) row.appendChild(extra);
        if (detail) row.appendChild(criarElemento('p', detail, 'osir-rx-detail'));

        container.appendChild(row);
        return estado;
    }

    function criarBotaoCopiarSinal(texto) {
        const btn = criarElemento('button', null, 'osir-rx-copy-mini');
        btn.type = 'button';
        btn.title = 'Copiar sinal';
        btn.setAttribute('aria-label', `Copiar sinal ${texto}`);
        btn.innerHTML = ICONS.copy;

        const restaurar = () => {
            if (!btn.isConnected) return;
            delete btn.dataset.state;
            btn.innerHTML = ICONS.copy;
            btn.title = 'Copiar sinal';
        };

        btn.addEventListener('click', async () => {
            try {
                await copiarTextoManual(texto);
                btn.dataset.state = 'copied';
                btn.innerHTML = ICONS.check;
                btn.title = 'Copiado';
                setTimeout(restaurar, 1200);
            } catch (error) {
                btn.dataset.state = 'failed';
                btn.innerHTML = ICONS.cross;
                btn.title = 'Erro ao copiar';
                setTimeout(restaurar, 1500);
            }
        });

        return btn;
    }

    function criarBlocoAlarme(texto) {
        const value = criarElemento('div', null, 'osir-rx-value');
        value.dataset.state = 'fail';
        value.appendChild(criarElemento('strong', texto));
        value.appendChild(criarBotaoCopiarSinal(texto));
        return value;
    }

    function criarBlocoRx(rxText, rxNumber, rxOk) {
        const value = criarElemento('div', null, 'osir-rx-value');
        value.dataset.state = rxNumber === null ? 'unknown' : (rxOk ? 'ok' : 'fail');
        value.appendChild(criarElemento('strong', rxNumber !== null ? String(rxNumber).replace('.', ',') : (rxText || '—')));
        if (rxNumber !== null) value.appendChild(criarElemento('span', 'dBm'));
        if (rxText) value.appendChild(criarBotaoCopiarSinal(rxText));
        return value;
    }

    // =====================================================================
    // COMPARAÇÃO DO PONTO DE ACESSO
    // =====================================================================

    function compararPontoAcesso(resultado, contexto) {
        const expectedOlt = String(contexto?.olt || '').trim();
        const expectedSlot = contexto?.slotPortaERP || null;
        const actualOlt = String(resultado?.oltVisor || '').trim();
        const actualPon = String(resultado?.portaPon || '').trim();
        const actualSlot = extrairSlotPortaPon(actualPon);

        let oltCorresponde;
        if (actualOlt) {
            oltCorresponde = normalizarNomeOlt(actualOlt) === normalizarNomeOlt(expectedOlt);
        } else {
            oltCorresponde = !resultado?.oltDiferente;
        }

        let slotPortaCorresponde = true;
        if (expectedSlot) {
            slotPortaCorresponde = Boolean(
                actualSlot && actualSlot.slot === expectedSlot.slot && actualSlot.porta === expectedSlot.porta
            );
        }

        const corresponde = Boolean(oltCorresponde && slotPortaCorresponde);
        const partesDetalhe = [];
        if (actualOlt) partesDetalhe.push(`OLT: ${actualOlt}`);
        partesDetalhe.push(actualPon ? `Porta PON: ${actualPon}` : 'Porta PON não identificada');
        const detalhe = partesDetalhe.join(' · ');

        return {
            corresponde, semPontoERP: !contexto?.accessPointRaw, oltCorresponde, slotPortaCorresponde, detalhe, actualOlt, actualPon, actualSlot
        };
    }

    // =====================================================================
    // ALERTA FLUTUANTE
    // =====================================================================

    function fecharAlerta(alertBox) {
        if (!alertBox?.isConnected || alertBox.dataset.leaving === 'true') return;
        clearTimeout(alertBox._closeTimer);
        alertBox.dataset.leaving = 'true';
        setTimeout(() => alertBox.remove(), 300);
    }

    function agendarFechamento(alertBox) {
        // Pausa ao passar o mouse ou focar, retoma com o tempo que restava
        let restante = ALERT_DURATION;
        let inicio = Date.now();

        const iniciar = () => {
            inicio = Date.now();
            clearTimeout(alertBox._closeTimer);
            alertBox._closeTimer = setTimeout(() => fecharAlerta(alertBox), restante);
        };

        const pausar = () => {
            clearTimeout(alertBox._closeTimer);
            restante = Math.max(1200, restante - (Date.now() - inicio));
        };

        alertBox.addEventListener('mouseenter', pausar);
        alertBox.addEventListener('focusin', pausar);
        alertBox.addEventListener('mouseleave', iniciar);
        alertBox.addEventListener('focusout', iniciar);

        iniciar();
    }

    function mostrarAlertaResultado(resultado, contexto) {
        injetarEstilos();
        document.getElementById(ALERT_ID)?.remove();

        const isSuccess = resultado?.tipo === 'sucesso';

        const alertBox = criarElemento('div', null, 'osir-rx-alert');
        alertBox.id = ALERT_ID;
        alertBox.setAttribute('role', 'alert');
        alertBox.setAttribute('aria-live', 'polite');

        const card = criarElemento('section', null, 'osir-rx-card');
        const body = criarElemento('div', null, 'osir-rx-body');

        let tudoOk = false;
        let sinalFora = false;
        let alarmeSinal = '';

        if (isSuccess) {
            const rxText = String(resultado.rx ?? '').trim();
            const alarme = String(resultado.alarme ?? '').trim();
            const rxNumber = alarme ? null : parseRx(rxText);
            const rxOk = !alarme && rxNumber !== null && rxNumber >= RX_MIN && rxNumber <= RX_MAX;

            if (alarme) {
                // Alarme (LOS/LOB): não há sinal válido, o alarme é o resultado e conta como fora do padrão
                criarLinhaAlerta(
                    body,
                    'Sinal',
                    false,
                    null,
                    false,
                    criarBlocoAlarme(alarme),
                    { ok: 'Dentro do padrão', fail: 'Fora do padrão' }
                );
                sinalFora = true;
                alarmeSinal = alarme;
            } else {
                criarLinhaAlerta(
                    body,
                    'Sinal',
                    rxOk,
                    rxNumber === null ? (rxText || 'Valor não disponível') : null,
                    rxNumber === null,
                    criarBlocoRx(rxText, rxNumber, rxOk),
                    { ok: 'Dentro do padrão', fail: 'Fora do padrão' }
                );
                sinalFora = rxNumber !== null && !rxOk;
            }

            const accessPoint = compararPontoAcesso(resultado, contexto);

            criarLinhaAlerta(
                body,
                'Ponto de acesso',
                accessPoint.corresponde,
                accessPoint.detalhe,
                accessPoint.semPontoERP,
                null,
                { ok: 'Confere', fail: 'Diferente' }
            );

            tudoOk = rxOk && accessPoint.corresponde;

            if (!accessPoint.corresponde && !accessPoint.semPontoERP) {
                if (accessPoint.oltCorresponde === false) {
                    mostrarAvisoBotaoAposAlerta('Encontrado em OLT diferente', 'different-olt');
                } else if (accessPoint.slotPortaCorresponde === false) {
                    mostrarAvisoBotaoAposAlerta('Ponto de Acesso diferente', 'different-olt');
                }
            }
        } else {
            criarLinhaAlerta(
                body,
                'Sinal',
                false,
                'Indisponível: a consulta não retornou um resultado válido.',
                true
            );

            criarLinhaAlerta(
                body,
                'Ponto de acesso',
                false,
                'Não foi possível validar sem localizar a ONT.',
                true
            );

            body.appendChild(
                criarElemento('div', resultado?.mensagem || 'ERRO: Falha na consulta', 'osir-rx-error')
            );
        }

        card.dataset.tone = tudoOk ? 'ok' : 'bad';

        // Cabeçalho
        const head = criarElemento('header', null, 'osir-rx-head');

        const mark = criarElemento('div', null, 'osir-rx-head-mark');
        mark.innerHTML = tudoOk ? ICONS.check : (isSuccess ? ICONS.signal : ICONS.alert);

        const headText = criarElemento('div', null, 'osir-rx-head-text');
        const titulo = !isSuccess ? 'Sem resultado' : (tudoOk ? 'Tudo dentro do padrão' : (alarmeSinal ? 'Alarme de sinal' : (sinalFora ? 'Sinal fora do padrão' : 'Ponto de acesso diferente')));
        headText.appendChild(criarElemento('h2', titulo, 'osir-rx-title'));
        if (contexto?.serial) {
            headText.appendChild(criarElemento('p', `Serial ${contexto.serial}`, 'osir-rx-subtitle'));
        }

        const closeBtn = criarElemento('button', null, 'osir-rx-close');
        closeBtn.type = 'button';
        closeBtn.title = 'Fechar';
        closeBtn.setAttribute('aria-label', 'Fechar resultado');
        closeBtn.innerHTML = ICONS.close;
        closeBtn.addEventListener('click', () => fecharAlerta(alertBox));

        head.append(mark, headText, closeBtn);

        // Barra de tempo restante
        const timer = criarElemento('div', null, 'osir-rx-timer');
        const fill = criarElemento('div', null, 'osir-rx-timer-fill');
        fill.style.animationDuration = `${ALERT_DURATION}ms`;
        timer.appendChild(fill);

        card.append(head, body, timer);
        alertBox.appendChild(card);
        document.body.appendChild(alertBox);

        agendarFechamento(alertBox);
    }

    function mostrarAvisoBotaoAposAlerta(texto, tipo) {
        const btn = document.getElementById(BUTTON_ID);
        if (!btn || btn.dataset.loading) return;
        setButtonDifferentPointState(btn, texto);
    }

    // =====================================================================
    // INJEÇÃO DO BOTÃO NO ERP
    // =====================================================================

    function injetarBotaoSeNecessario() {
        const inputEl = document.querySelector('#equipmentSerialNumber');
        if (!inputEl) return;
        if (document.getElementById(BUTTON_ID)) return;

        const container = inputEl.closest('.MuiFormControl-root');
        if (!container?.parentNode) return;

        injetarEstilos();

        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.type = 'button';
        btn.className = 'osir-rx-btn';

        setButtonDefaultState(btn);

        btn.addEventListener('click', () => {
            if (btn.dataset.loading) return;
            limparEstadoAviso(btn);

            const serial = String(inputEl.value || '').trim();
            if (!serial) {
                setButtonDefaultState(btn);
                alert('O campo do serial está vazio!');
                return;
            }

            const oltElement = document.querySelector('#authenticationAccessPointId');
            const accessPointRaw = oltElement ? String(oltElement.value || oltElement.innerText || oltElement.textContent || '').trim() : '';

            const olt = traduzirAccessPoint(accessPointRaw);
            const slotPortaERP = extrairSlotPortaERP(accessPointRaw);
            const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

            currentRequest = { requestId, serial, accessPointRaw, olt, slotPortaERP };

            document.getElementById(ALERT_ID)?.remove();

            setButtonLoadingState(btn);

            const payload = JSON.stringify({ requestId, serial, olt, accessPointRaw, slotPortaERP, timestamp: Date.now() });

            GM_setValue(REQUEST_KEY, '');
            setTimeout(() => GM_setValue(REQUEST_KEY, payload), 100);
        });

        container.parentNode.style.display = 'flex';
        container.parentNode.style.alignItems = 'center';
        container.parentNode.insertBefore(btn, container.nextSibling);
    }

    // =====================================================================
    // OBSERVER DA SPA DO ERP
    // =====================================================================

    function iniciarObserverErp() {
        if (!document.body) return;
        const observer = new MutationObserver(() => injetarBotaoSeNecessario());
        observer.observe(document.body, { childList: true, subtree: true });
        injetarBotaoSeNecessario();
    }

    // =====================================================================
    // RECEBE RESULTADO
    // =====================================================================

    GM_addValueChangeListener(RESULT_KEY, function (name, oldValue, rawResult, remote) {
        if (!remote || !rawResult) return;

        let result;
        try {
            result = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
        } catch (error) { return; }

        if (!currentRequest || result.requestId !== currentRequest.requestId) return;

        const btn = document.getElementById(BUTTON_ID);
        if (btn) delete btn.dataset.loading;

        if (result.tipo === 'sucesso') {
            const rx = String(result.rx ?? '').trim();

            if (!rx && !String(result.alarme ?? '').trim()) {
                const errorResult = { tipo: 'erro', mensagem: 'ERRO: Valor RX em branco' };
                mostrarAlertaResultado(errorResult, currentRequest);
                if (btn) setButtonErrorState(btn, errorResult.mensagem);
            } else {
                if (btn) setButtonDefaultState(btn);
                mostrarAlertaResultado(result, currentRequest);
            }
        } else {
            const message = result.mensagem || 'ERRO: Falha na consulta';
            if (btn) setButtonErrorState(btn, message);
            mostrarAlertaResultado({ ...result, mensagem: message }, currentRequest);
        }

        setTimeout(() => GM_setValue(RESULT_KEY, ''), 200);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarObserverErp, { once: true });
    } else {
        iniciarObserverErp();
    }
})();
