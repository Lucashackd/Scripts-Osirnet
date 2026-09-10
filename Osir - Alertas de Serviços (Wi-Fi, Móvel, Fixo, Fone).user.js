// ==UserScript==
// @name         Osir - Alertas de Serviços (Wi-Fi, Móvel, Fixo, Fone)
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Verifica a tabela e exibe badges inteligentes com alto contraste e bordas completas. (CSS blindado)
// @author       Lucas Hackbart Döhnert
// @match        https://erp.osirnet.com.br/authentication_contracts/contract_panel/*
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/Lucashackd/Scripts-Osirnet
// @downloadURL  https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/
// @updateURL    https://raw.githubusercontent.com/Lucashackd/Scripts-Osirnet/main/
// @supportURL   https://github.com/Lucashackd/Scripts-Osirnet/issues
// ==/UserScript==

(function() {
    'use strict';

    const containerId = 'custom-services-badges-container';

    const servicesConfig = [
        {
            id: 'wifi-pro',
            keywords: ['wi-fi pro'],
            title: 'Wi-Fi Pro',
            bgColor: '#047857',
            borderColor: '#022c22',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>`
        },
        {
            id: 'osirfone',
            keywords: ['osirfone', 'telefonia'],
            title: 'OsirFone',
            bgColor: '#1d4ed8',
            borderColor: '#1e3a8a',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`
        },
        {
            id: 'osirmovel',
            keywords: ['osirmovel'],
            title: 'OsirMóvel',
            bgColor: '#c2410c',
            borderColor: '#7c2d12',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`
        },
        {
            id: 'ip-fixo',
            keywords: ['ip fixo'],
            title: 'IP Fixo',
            bgColor: '#6d28d9',
            borderColor: '#4c1d95',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`
        }
    ];

    function injectStyles() {
        if (!document.getElementById('services-badges-styles')) {
            const style = document.createElement('style');
            style.id = 'services-badges-styles';
            style.innerHTML = `
                .custom-badges-wrapper {
                    display: flex !important;
                    flex-wrap: wrap !important;
                    gap: 14px !important;
                    margin: 10px 0 15px 0 !important;
                    width: 100% !important;
                    clear: both !important;
                }
                .service-badge {
                    color: #ffffff !important;
                    /* O !important força o padding acima de qualquer CSS global do sistema */
                    padding: 8px 16px !important;
                    border-radius: 8px !important;
                    font-family: 'Roboto', Arial, sans-serif !important;
                    font-size: 14.5px !important;
                    font-weight: 600 !important;
                    letter-spacing: 0.3px !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 10px !important;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.15) !important;
                    /* box-sizing garante que borda e padding não quebrem a caixa */
                    box-sizing: border-box !important;
                    line-height: 1.2 !important; /* Previne que o sistema imponha uma altura de linha estranha */
                    animation: slideDownCustom 0.3s ease-out forwards;
                }
                .service-badge svg {
                    flex-shrink: 0 !important;
                    width: 20px !important;
                    height: 20px !important;
                    display: block !important;
                }
                .service-badge span {
                    display: inline-block !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                @keyframes slideDownCustom {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    function checkServices() {
        const tableBody = document.querySelector('#servicesTable tbody');
        const wrapper = document.getElementById('servicesTable_wrapper');

        if (!tableBody || !wrapper) return;

        const normalizedTableText = tableBody.textContent
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, "");

        let badgesHTML = '';
        let matchCount = 0;

        servicesConfig.forEach(svc => {
            const hasMatch = svc.keywords.some(keyword => normalizedTableText.includes(keyword));

            if (hasMatch) {
                matchCount++;
                // O style inline ganha !important também por garantia
                badgesHTML += `
                    <div class="service-badge" style="background-color: ${svc.bgColor} !important; border: 2px solid ${svc.borderColor} !important;">
                        ${svc.icon}
                        <span>${svc.title}</span>
                    </div>
                `;
            }
        });

        let existingContainer = document.getElementById(containerId);

        if (matchCount > 0) {
            if (!existingContainer) {
                existingContainer = document.createElement('div');
                existingContainer.id = containerId;
                existingContainer.className = 'custom-badges-wrapper';

                const scrollDiv = wrapper.querySelector('.dataTables_scroll');
                if (scrollDiv) {
                    wrapper.insertBefore(existingContainer, scrollDiv);
                } else {
                    wrapper.prepend(existingContainer);
                }
            }

            if (existingContainer.innerHTML !== badgesHTML) {
                existingContainer.innerHTML = badgesHTML;
            }

        } else {
            if (existingContainer) {
                existingContainer.remove();
            }
        }
    }

    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;

        for (let mutation of mutations) {
            if (mutation.target.id === containerId || (mutation.target.className && typeof mutation.target.className === 'string' && mutation.target.className.includes('custom-badges-wrapper'))) {
                continue;
            }

            if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                shouldCheck = true;
                break;
            }
        }

        if (shouldCheck) {
            setTimeout(checkServices, 50);
        }
    });

    injectStyles();
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(checkServices, 200);

})();
