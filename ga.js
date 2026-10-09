// ga.js - Google Analytics 4 bootstrap for the agent registry.
//
// The stock gtag snippet is an inline <script>, which this page's CSP forbids
// (script-src 'self', no unsafe-inline - see the CSP comment in index.html and
// registry/backend/frontend_test.go, which fails the build on any inline tag).
// So the bootstrap lives here, self-hosted, and is loaded with
// <script src="ga.js">. The gtag library itself still loads from
// googletagmanager.com via the async loader in index.html.
//
// This shim only queues commands onto dataLayer; the real gtag (loaded async)
// replays the queue when it initialises, so ordering here is not significant.
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());

gtag('config', 'G-1MPT6SXMJN');
