// ==UserScript==
// @name         Osir - Máscara Portabilidade YGO
// @namespace    https://github.com/Lucashackd/Scripts-Osirnet
// @version      1.0
// @description  Abre uma máscara editável de portabilidade com dados preenchidos automaticamente.
// @author       Lucashackd
// @match        https://ygo.osirnet.com.br/mvno/cliente/adicionar
// @run-at       document-idle
// @noframes
// @grant        GM_setClipboard
// @license      MIT
// @homepageURL  https://github.com/Lucashackd/Scripts-Osirnet
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// ==/UserScript==

(function () {
    'use strict';

    const TARGET_ORIGIN = 'https://ygo.osirnet.com.br';
    const TARGET_PATH = '/mvno/cliente/adicionar';

    const BUTTON_ID = 'osir-mascara-portabilidade-button';
    const MODAL_ID = 'osir-mascara-portabilidade-modal';
    const STYLE_ID = 'osir-mascara-portabilidade-style';

    const MISSING = 'Não encontrado';

    if (
        location.origin !== TARGET_ORIGIN ||
        location.pathname !== TARGET_PATH
    ) {
        return;
    }

    // =========================================================
    // UTILITÁRIOS
    // =========================================================

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Obtém os cartões das áreas de cadastro e retorno da operadora.
    // A classe real dos cartões é .summary-item.
    function getSummaryItems() {
        const sections = [
            document.querySelector('#summaryCadastro'),
            document.querySelector('#summaryOperadora')
        ].filter(Boolean);

        const roots = sections.length
            ? sections
            : [document];

        const items = roots.flatMap((root) =>
            Array.from(
                root.querySelectorAll(
                    '.summary-grid .summary-item'
                )
            )
        );

        return [...new Set(items)];
    }

    // Obtém o rótulo exibido no <span> de cada cartão.
    function getItemLabel(item) {
        return normalizeText(
            item?.querySelector('span')?.textContent || ''
        );
    }

    // Obtém o conteúdo do <strong> de cada cartão.
    function getItemValue(item) {
        const strong = item?.querySelector('strong');

        const value = String(
            strong?.innerText ??
            strong?.textContent ??
            ''
        ).trim();

        return value || MISSING;
    }

    // Localiza um cartão pelo seu rótulo.
    function findItemByLabel(items, pattern) {
        return items.find((item) =>
            pattern.test(getItemLabel(item))
        ) || null;
    }

    // =========================================================
    // DATAS
    // =========================================================

    function parseDate(value) {
        const text = String(value || '').trim();

        let year;
        let month;
        let day;
        let match;

        // Formato ISO: AAAA-MM-DD.
        match = text.match(
            /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/
        );

        if (match) {
            year = Number(match[1]);
            month = Number(match[2]);
            day = Number(match[3]);
        } else {
            // Formatos brasileiros:
            // DD/MM/AAAA, DD-MM-AAAA ou DD.MM.AAAA.
            match = text.match(
                /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/
            );

            if (!match) {
                return null;
            }

            day = Number(match[1]);
            month = Number(match[2]);
            year = Number(match[3]);
        }

        const date = new Date(
            year,
            month - 1,
            day
        );

        // Impede a aceitação de datas inválidas.
        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return null;
        }

        return date;
    }

    // Adiciona dez dias à data informada.
    function addSevenDays(value) {
        if (!value || value === MISSING) {
            return MISSING;
        }

        const date = parseDate(value);

        if (!date) {
            return MISSING;
        }

        date.setDate(date.getDate() + 7);

        const day = String(
            date.getDate()
        ).padStart(2, '0');

        const month = String(
            date.getMonth() + 1
        ).padStart(2, '0');

        return `${day}/${month}/${date.getFullYear()}`;
    }

    // =========================================================
    // CAPTAÇÃO DOS DADOS
    // =========================================================

    function getInputValue(selector) {
        const input =
            document.querySelector(
                `.form-grid .field.col-6 ${selector}`
            ) ||
            document.querySelector(selector);

        return String(input?.value ?? '').trim();
    }

    function collectPageValues() {
        const items = getSummaryItems();

        // -----------------------------------------------------
        // 1. NÚMERO DE TELEFONE PROVISÓRIO
        // -----------------------------------------------------
        //
        // No HTML informado:
        // <span>Numero da linha atribuida</span>
        // <strong>53920031650</strong>
        //
        // A busca utiliza o rótulo, não a posição do cartão.

        const provisionalPhoneItem = findItemByLabel(
            items,
            /numero da linha atribuida|telefone provisorio|numero provisorio|linha provisoria/
        );

        const provisionalPhone = getItemValue(
            provisionalPhoneItem
        );

        // -----------------------------------------------------
        // 2. ICCID
        // -----------------------------------------------------
        //
        // Prioriza o cartão:
        // <span>ICCID</span>
        // <strong>8955170110401386980</strong>
        //
        // Se não existir, tenta obter o ICCID pelo cartão SIM Card.

        const iccidItem = findItemByLabel(
            items,
            /\biccid\b/
        );

        const simCardItem = findItemByLabel(
            items,
            /sim card/
        );

        let iccid = getItemValue(iccidItem);

        if (iccid === MISSING && simCardItem) {
            const simCardValue = getItemValue(
                simCardItem
            );

            const match = simCardValue.match(
                /\bICCID\s*:\s*([\d\s]+)/i
            );

            iccid = match
                ? match[1].replace(/\s+/g, '')
                : simCardValue;
        } else if (iccid !== MISSING) {
            iccid = iccid
                .replace(/^ICCID\s*:\s*/i, '')
                .trim();
        }

        // -----------------------------------------------------
        // 3. DATA PREVISTA
        // -----------------------------------------------------
        //
        // Primeiro procura uma data explicitamente identificada
        // como Data Prevista ou relacionada à portabilidade.
        //
        // No HTML fornecido, o campo disponível é Data ativacao.
        // Nesse caso, essa data será utilizada como referência.
        //
        // A data final corresponde à referência + 10 dias.

        const forecastDateItem = findItemByLabel(
            items,
            /data prevista|data.*portabilidade|previsao.*portabilidade/
        );

        const activationDateItem = findItemByLabel(
            items,
            /data ativacao|data de ativacao/
        );

        const dateItem =
            forecastDateItem ||
            activationDateItem;

        const rawDate = getItemValue(dateItem);

        const expectedDate = addSevenDays(rawDate);

        // -----------------------------------------------------
        // 4. NÚMERO PORTADO
        // -----------------------------------------------------
        //
        // Durante o preenchimento, utiliza #ddd + #msisdn.
        //
        // Caso esses inputs não estejam disponíveis na tela
        // de retorno, utiliza o valor de Linha solicitada.

        const ddd = getInputValue('#ddd');
        const msisdn = getInputValue('#msisdn');

        let portedNumber = '';

        if (ddd && msisdn) {
            const cleanDdd = ddd.replace(/\D/g, '');

            portedNumber = cleanDdd
                ? `(${cleanDdd}) ${msisdn.trim()}`
                : msisdn.trim();
        } else {
            const requestedLineItem = findItemByLabel(
                items,
                /linha solicitada|numero portado|numero a portar/
            );

            portedNumber = getItemValue(
                requestedLineItem
            );

            if (
                portedNumber === MISSING &&
                msisdn
            ) {
                portedNumber = msisdn;
            }
        }

        return {
            provisionalPhone,
            iccid,
            expectedDate,
            portedNumber
        };
    }

    // =========================================================
    // TEXTO DA MÁSCARA
    // =========================================================

    function buildMask() {
        const values = collectPageValues();

        return [
            'CHIP: ESim ( ) Sim Card (X)',
            '',
            'PORTABILIDADE EM NOME DE 3º: SIM ( ) NÃO (X)',
            '',
            `Nº Telefone Provisório: ${values.provisionalPhone}`,
            `Iccid: ${values.iccid}`,
            '',
            'Dados da Portabilidade:',
            `Data Prevista: ${values.expectedDate}`,
            `Número Portado: ${values.portedNumber}`,
            'Status: Portabilidade Agendada',
            '',
            'Cliente ciente do prazo de 24hs para a confirmação via sms? SIM (X) NÃO ( )',
            '',
            'Ciente da Data Prevista? SIM (X) NÃO ( )'
        ].join('\n');
    }

    // =========================================================
    // ESTILOS
    // =========================================================

    function addStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');

        style.id = STYLE_ID;

        style.textContent = `
            #${BUTTON_ID} {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                margin: 0 0 0 10px;
                padding: 9px 13px;
                border: 1px solid #1d4ed8;
                border-radius: 7px;
                background: #2563eb;
                color: #ffffff;
                font: 600 13px/1.25 system-ui, sans-serif;
                cursor: pointer;
                box-shadow: 0 2px 5px rgba(0, 0, 0, .18);
                transition: background .15s ease, transform .15s ease;
            }

            #${BUTTON_ID}:hover {
                background: #1d4ed8;
            }

            #${BUTTON_ID}:active {
                transform: translateY(1px);
            }

            #${BUTTON_ID}:focus-visible {
                outline: 3px solid #60a5fa;
                outline-offset: 3px;
            }

            #${MODAL_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(2, 6, 23, .82);
                backdrop-filter: blur(4px);
                box-sizing: border-box;
            }

            #${MODAL_ID} * {
                box-sizing: border-box;
            }

            #${MODAL_ID} .osir-port-modal-card {
                display: flex;
                flex-direction: column;
                width: min(680px, 100%);
                max-height: min(88vh, 900px);
                overflow: hidden;
                border: 1px solid #475569;
                border-radius: 14px;
                background: #111827;
                color: #f8fafc;
                box-shadow: 0 22px 70px rgba(0, 0, 0, .55);
                font-family: system-ui, -apple-system,
                    BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            #${MODAL_ID} .osir-port-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding: 18px 22px;
                border-bottom: 1px solid #374151;
                background: #172033;
            }

            #${MODAL_ID} .osir-port-modal-title {
                margin: 0;
                color: #ffffff;
                font-size: 18px;
                line-height: 1.35;
                font-weight: 700;
            }

            #${MODAL_ID} .osir-port-modal-description {
                margin: 5px 0 0;
                color: #cbd5e1;
                font-size: 12px;
            }

            #${MODAL_ID} .osir-port-modal-content {
                display: flex;
                flex: 1;
                flex-direction: column;
                min-height: 0;
                padding: 18px 22px 12px;
                background: #111827;
            }

            #${MODAL_ID} textarea {
                width: 100%;
                min-height: 270px;
                flex: 1;
                resize: vertical;
                padding: 14px;
                border: 1px solid #64748b;
                border-radius: 8px;
                outline: none;
                background: #0b1220;
                color: #f8fafc;
                caret-color: #93c5fd;
                font: 13px/1.7 ui-monospace, SFMono-Regular,
                    Menlo, Monaco, Consolas, "Liberation Mono", monospace;
                white-space: pre-wrap;
            }

            #${MODAL_ID} textarea::selection {
                background: #1d4ed8;
                color: #ffffff;
            }

            #${MODAL_ID} textarea:focus {
                border-color: #60a5fa;
                box-shadow: 0 0 0 3px rgba(96, 165, 250, .2);
                background: #111c30;
                color: #ffffff;
            }

            #${MODAL_ID} .osir-port-modal-status {
                min-height: 18px;
                padding-top: 8px;
                color: #86efac;
                font-size: 12px;
            }

            #${MODAL_ID} .osir-port-modal-footer {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 0;
                padding: 22px 16px;
                border-top: 1px solid #374151;
                background: #172033;
            }

            #${MODAL_ID} .osir-port-modal-action {
                min-width: 94px;
                padding: 9px 16px;
                border: 1px solid #64748b;
                border-radius: 7px;
                background: #334155;
                color: #ffffff;
                font: 600 13px system-ui, sans-serif;
                cursor: pointer;
                transition: background .15s ease, border-color .15s ease;
            }

            #${MODAL_ID} .osir-port-modal-action:hover {
                background: #475569;
                border-color: #94a3b8;
            }

            #${MODAL_ID} .osir-port-modal-action:focus-visible {
                outline: 3px solid #60a5fa;
                outline-offset: 3px;
            }

            #${MODAL_ID} .osir-port-modal-copy {
                border-color: #2563eb;
                background: #2563eb;
                color: #ffffff;
            }

            #${MODAL_ID} .osir-port-modal-copy:hover {
                border-color: #3b82f6;
                background: #1d4ed8;
            }

            @media (max-width: 520px) {
                #${MODAL_ID} {
                    padding: 10px;
                }

                #${MODAL_ID} .osir-port-modal-header,
                #${MODAL_ID} .osir-port-modal-content,
                #${MODAL_ID} .osir-port-modal-footer {
                    padding-left: 14px;
                    padding-right: 14px;
                }

                #${MODAL_ID} .osir-port-modal-title {
                    font-size: 16px;
                }

                #${MODAL_ID} textarea {
                    min-height: 230px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // =========================================================
    // MODAL
    // =========================================================

    function closeModal() {
        document.getElementById(MODAL_ID)?.remove();

        document.removeEventListener(
            'keydown',
            handleKeydown,
            true
        );
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }

    // =========================================================
    // CÓPIA PARA A ÁREA DE TRANSFERÊNCIA
    // =========================================================

    async function copyText(textarea, status) {
        const text = textarea.value;

        try {
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(text, 'text');
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                textarea.focus();
                textarea.select();

                const copied = document.execCommand('copy');

                if (!copied) {
                    throw new Error(
                        'O navegador não permitiu copiar o texto.'
                    );
                }
            }

            status.textContent =
                'Texto copiado para a área de transferência.';

            status.style.color = '#86efac';
        } catch (error) {
            console.error(
                '[Osir - Máscara Portabilidade] Falha ao copiar:',
                error
            );

            status.textContent =
                'Não foi possível copiar automaticamente. ' +
                'Selecione o texto e copie manualmente.';

            status.style.color = '#fca5a5';
        }
    }

    // =========================================================
    // ABERTURA DO MODAL
    // =========================================================

    function openModal() {
        closeModal();
        addStyles();

        const backdrop = document.createElement('div');

        backdrop.id = MODAL_ID;
        backdrop.setAttribute('role', 'presentation');

        backdrop.innerHTML = `
            <section
                class="osir-port-modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="osir-port-modal-title"
            >
                <header class="osir-port-modal-header">
                    <div>
                        <h2
                            class="osir-port-modal-title"
                            id="osir-port-modal-title"
                        >
                            Máscara Portabilidade
                        </h2>

                        <p class="osir-port-modal-description">
                            Revise ou edite o texto antes de copiar.
                        </p>
                    </div>
                </header>

                <div class="osir-port-modal-content">
                    <textarea
                        id="osir-port-modal-text"
                        aria-label="Texto da máscara de portabilidade"
                        spellcheck="false"
                        autofocus
                    ></textarea>

                    <div
                        class="osir-port-modal-status"
                        id="osir-port-modal-status"
                        aria-live="polite"
                    ></div>
                </div>

                <footer class="osir-port-modal-footer">
                    <button
                        type="button"
                        class="osir-port-modal-action"
                        id="osir-port-modal-close"
                    >
                        Fechar
                    </button>

                    <button
                        type="button"
                        class="osir-port-modal-action osir-port-modal-copy"
                        id="osir-port-modal-copy"
                    >
                        Copiar
                    </button>
                </footer>
            </section>
        `;

        // Fecha quando o usuário clica no fundo, fora do cartão.
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) {
                closeModal();
            }
        });

        document.body.appendChild(backdrop);

        const textarea = backdrop.querySelector(
            '#osir-port-modal-text'
        );

        const status = backdrop.querySelector(
            '#osir-port-modal-status'
        );

        // Preenche a máscara com os valores identificados.
        textarea.value = buildMask();

        backdrop
            .querySelector('#osir-port-modal-close')
            .addEventListener('click', closeModal);

        backdrop
            .querySelector('#osir-port-modal-copy')
            .addEventListener('click', () => {
                copyText(textarea, status);
            });

        document.addEventListener(
            'keydown',
            handleKeydown,
            true
        );

        // Coloca o foco diretamente na área editável.
        textarea.focus({ preventScroll: true });

        // Reforça o foco após a renderização do modal.
        requestAnimationFrame(() => {
            if (
                document.getElementById(MODAL_ID) === backdrop &&
                textarea.isConnected
            ) {
                textarea.focus({ preventScroll: true });
            }
        });
    }

    // =========================================================
    // BOTÃO DE ABERTURA
    // =========================================================

    function ensureButton() {
        if (
            location.origin !== TARGET_ORIGIN ||
            location.pathname !== TARGET_PATH
        ) {
            document.getElementById(BUTTON_ID)?.remove();
            closeModal();
            return;
        }

        const headerTag = document.querySelector(
            'div.mvno-header-tag'
        );

        if (
            !headerTag ||
            document.getElementById(BUTTON_ID)
        ) {
            return;
        }

        addStyles();

        const button = document.createElement('button');

        button.id = BUTTON_ID;
        button.type = 'button';
        button.textContent = 'Máscara Portabilidade';

        button.title =
            'Abrir máscara de portabilidade preenchida com os dados desta página';

        button.addEventListener('click', openModal);

        headerTag.insertAdjacentElement(
            'afterend',
            button
        );
    }

    ensureButton();

    // Observa a página caso o cabeçalho seja renderizado dinamicamente.
    const observer = new MutationObserver(() => {
        ensureButton();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

})();
