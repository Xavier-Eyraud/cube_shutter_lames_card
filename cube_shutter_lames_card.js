/**
 * Shutter Lames Card - carte Home Assistant autonome pour volets roulants (cover)
 * Visuel pur (pas d'en-tête, pas d'icône) : N lames glissables (clic-glissé) pour piloter
 * la position par pas de 100/N %. Les séparateurs de lames ne sont visibles que dans la
 * zone fermée (au-dessus de la limite ouverte/fermée), jamais dans la zone ouverte.
 */

class ShutterLamesCard extends HTMLElement {
    static getStubConfig() {
        return { entity: "cover.exemple" };
    }

    setConfig(config) {
        if (!config.entity) throw new Error("Il faut définir une entité (cover.xxx)");
        this._config = config;
        this._dragPosition = null;
        if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    }

    set hass(hass) {
        this._hass = hass;
        this._render();
    }

    getCardSize() {
        return 4;
    }

    get _stateObj() {
        return this._hass?.states[this._config.entity];
    }

    get _lames() {
        return this._config.lames || 4;
    }

    get _steps() {
        const n = this._lames;
        const step = 100 / n;
        return Array.from({ length: n + 1 }, (_, i) => Math.round(i * step));
    }

    get _position() {
        if (this._dragPosition != null) return this._dragPosition;
        const attrs = this._stateObj?.attributes || {};
        if (attrs.current_position != null) return attrs.current_position;
        return this._stateObj?.state === "closed" ? 0 : 100;
    }

    get _color() {
        return this._config.color || "var(--primary-color, #f5a623)";
    }

    _nearestStep(pos) {
        return this._steps.reduce((a, b) => (Math.abs(b - pos) < Math.abs(a - pos) ? b : a));
    }

    _setPosition(position) {
        this._hass.callService("cover", "set_cover_position", {
            entity_id: this._config.entity,
            position,
        });
    }

    _positionFromEvent(container, clientY) {
        const rect = container.getBoundingClientRect();
        const fraction = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
        return this._nearestStep(Math.round(100 - fraction * 100));
    }

    _attachDrag(container) {
        let dragging = false;

        const onMove = (ev) => {
            if (!dragging) return;
            const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
            this._dragPosition = this._positionFromEvent(container, clientY);
            this._updateVisual(container);
        };

        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            if (this._dragPosition != null) {
                this._setPosition(this._dragPosition);
            }
        };

        container.addEventListener("pointerdown", (ev) => {
            ev.preventDefault();
            dragging = true;
            this._dragPosition = this._positionFromEvent(container, ev.clientY);
            this._updateVisual(container);
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
        });
    }

    _updateVisual(container) {
        const position = this._position;
        const filledPercent = 100 - position;
        container.querySelector(".fill").style.height = `${filledPercent}%`;
        container.querySelectorAll(".lame-line").forEach((line) => {
            const boundary = parseFloat(line.dataset.boundary);
            line.style.display = boundary <= filledPercent + 0.01 ? "block" : "none";
        });
    }

    _render() {
        if (!this._hass || !this._config) return;

        const style = `
            :host { display: block; }
            .card-root {
                background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
                border-radius: var(--ha-card-border-radius, 12px);
                overflow: hidden;
                box-shadow: var(--ha-card-box-shadow, none);
                display: flex;
                justify-content: center;
                padding: 16px;
            }
            .lames {
                position: relative;
                width: 100%;
                max-width: 160px;
                height: 220px;
                border-radius: 6px;
                background: rgba(127,127,127,0.12);
                border: 2px solid rgba(127,127,127,0.25);
                overflow: hidden;
                touch-action: none;
                cursor: grab;
                user-select: none;
                -webkit-user-select: none;
            }
            .lames .fill {
                position: absolute;
                top: 0; left: 0; right: 0;
                background: ${this._color};
            }
            .lames .lame-line {
                position: absolute;
                left: 0; right: 0;
                height: 1px;
                background: rgba(0,0,0,0.28);
            }
        `;

        const boundaries = this._steps.slice(1, -1); // limites internes (hors 0 et 100)
        const lines = boundaries
            .map((b) => `<div class="lame-line" data-boundary="${b}" style="top:${b}%"></div>`)
            .join("");

        this.shadowRoot.innerHTML = `
            <style>${style}</style>
            <div class="card-root">
                <div class="lames">
                    <div class="fill"></div>
                    ${lines}
                </div>
            </div>`;

        const lamesContainer = this.shadowRoot.querySelector(".lames");
        this._updateVisual(lamesContainer);
        this._attachDrag(lamesContainer);
    }
}

customElements.define("shutter-lames-card", ShutterLamesCard);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "shutter-lames-card",
    name: "Shutter Lames Card",
    description: "Carte volet roulant : N lames glissables (clic-glissé) pour piloter la position par pas de 100/N %.",
    preview: true,
});
