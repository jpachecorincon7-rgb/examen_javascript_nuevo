import { ApiService } from '../services/api.js';
import { StorageService } from '../services/storage.js';

// Evita inyección de HTML al pintar textos del usuario o de la API
const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

class ImportModal extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // Requerimiento: Shadow DOM
        this.existingTasks = [];
        this.onImportCallback = null;
        this.bank = null;        // Banco completo (200 tareas) una vez descargado
        this._loading = false;
        this._opener = null;
    }

    // Se construye una sola vez (así la hoja de estilos ya está cargada cuando se abre)
    connectedCallback() {
        if (this._init) return;
        this._init = true;
        this.renderStructure();
        this.setupEvents();
    }

    $(selector) { return this.shadowRoot.querySelector(selector); }

    // Se invoca desde task-app: open(tareasActuales, callback)
    // El callback recibe el arreglo completo: tareas actuales + las importadas.
    async open(currentTasks = [], callback = () => {}) {
        this.existingTasks = currentTasks;
        this.onImportCallback = callback;
        this._opener = this.getRootNode().activeElement;

        this.$('#buscar').value = '';

        // Cargar categorías y poblar el select
        const categories = StorageService.getCategories();
        const categorySelect = this.$('#import-category');
        categorySelect.innerHTML =
            '<option value="">— Sin categoría —</option>' +
            categories
                .map((cat) => `<option value="${escapeHTML(cat.id)}">${escapeHTML(cat.name)}</option>`)
                .join('');

        this.setBackgroundInert(true);
        this.$('#modal').hidden = false;
        this.$('#buscar').focus();

        await this.loadBank();
    }

    // Descarga las 200 tareas (o reutiliza las ya descargadas) con manejo de errores
    async loadBank() {
        if (this._loading) return;
        if (this.bank) { this.renderList(); return; }

        this._loading = true;
        this.$('#reintentar').hidden = true;
        this.$('#lista-importar').replaceChildren();
        this.$('#sin-resultados').hidden = true;
        this.showStatus('Cargando tareas del banco…');
        this.updateCount();

        try {
            this.bank = await ApiService.fetchTodoBank();
            this.renderList();
        } catch (error) {
            this.bank = null;
            this.showStatus(error.message, true);
            this.$('#reintentar').hidden = false;
        } finally {
            this._loading = false;
        }
    }

    // Dibuja las tareas del banco. Las que ya están importadas quedan deshabilitadas.
    renderList() {
        const importedIds = new Set(this.existingTasks.map((t) => String(t.id)));
        const list = this.$('#lista-importar');
        list.replaceChildren();

        this.bank.forEach((todo) => {
            const alreadyImported = importedIds.has(StorageService.generateId('api', todo.id));
            const inputId = `imp-${todo.id}`;

            const row = document.createElement('div');
            row.className = 'tarea-importar';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = inputId;
            checkbox.value = String(todo.id);
            checkbox.disabled = alreadyImported;

            const label = document.createElement('label'); // textContent: nunca se interpreta HTML
            label.htmlFor = inputId;
            label.textContent = todo.title + (alreadyImported ? ' (ya importada)' : '');

            row.append(checkbox, label);
            list.append(row);
        });

        this.$('#seleccionar-todas').checked = false;
        this.showStatus(`${this.bank.length} tareas disponibles. Marca las que quieras importar.`);
        this.applyFilter();
        this.updateCount();
    }

    // Buscador: oculta las filas que no coinciden
    applyFilter() {
        const q = this.$('#buscar').value.trim().toLowerCase();
        let visible = 0;
        this.shadowRoot.querySelectorAll('#lista-importar .tarea-importar').forEach((row) => {
            const show = row.textContent.toLowerCase().includes(q);
            row.hidden = !show;
            if (show) visible++;
        });
        this.$('#sin-resultados').hidden = !(this.bank && visible === 0);
    }

    // Contador de seleccionadas y estado del botón "Importar"
    updateCount() {
        const n = this.shadowRoot.querySelectorAll('#lista-importar input:checked:not(:disabled)').length;
        const button = this.$('#confirmar');
        button.disabled = n === 0;
        button.textContent = n ? `Importar seleccionadas (${n})` : 'Importar seleccionadas';
    }

    showStatus(message, isError = false) {
        const box = this.$('#estado');
        box.textContent = message;
        box.classList.toggle('error', isError);
    }

    setupEvents() {
        const modal = this.$('#modal');

        this.$('#cancelar').addEventListener('click', () => this.hideModal());
        this.$('#reintentar').addEventListener('click', () => this.loadBank());

        // Esc cierra y clic en el fondo oscuro también
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); this.hideModal(); }
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) this.hideModal(); });

        this.$('#buscar').addEventListener('input', () => this.applyFilter());

        this.$('#lista-importar').addEventListener('change', () => this.updateCount());

        // Seleccionar (o quitar) todas las tareas visibles y habilitadas
        this.$('#seleccionar-todas').addEventListener('change', (e) => {
            this.shadowRoot
                .querySelectorAll('#lista-importar .tarea-importar:not([hidden]) input:not(:disabled)')
                .forEach((cb) => { cb.checked = e.target.checked; });
            this.updateCount();
        });

        this.$('#confirmar').addEventListener('click', () => this.importSelected());
    }

    // Convierte las tareas marcadas al formato propio y las envía a task-app
    importSelected() {
        const today = new Date().toLocaleDateString('en-CA');
        const existingIds = new Set(this.existingTasks.map((t) => String(t.id)));

        // Leer la categoría seleccionada para las tareas importadas
        const categoryId = this.$('#import-category').value || null;

        const newTasks = [...this.shadowRoot.querySelectorAll('#lista-importar input:checked:not(:disabled)')]
            .map((cb) => this.bank.find((todo) => String(todo.id) === cb.value))
            .filter(Boolean)
            .map((todo) => ({
                id: StorageService.generateId('api', todo.id), // "api-<id>": solo lectura
                title: String(todo.title),
                date: today,
                completed: !!todo.completed,
                categoryId: categoryId   // Categoría seleccionada al importar
            }))
            .filter((task) => !existingIds.has(task.id)); // Nunca se duplican

        if (!newTasks.length) return;

        this.onImportCallback([...newTasks, ...this.existingTasks]);
        this.hideModal();
    }

    hideModal() {
        this.$('#modal').hidden = true;
        this.setBackgroundInert(false);
        // Si el botón que abrió el modal ya no existe, se enfoca "Importar Tareas"
        const target = this._opener && this._opener.isConnected
            ? this._opener
            : this.getRootNode().getElementById('btn-import');
        if (target && target.focus) target.focus();
    }

    // Mientras el modal está abierto, el resto del panel no recibe foco ni clics
    setBackgroundInert(value) {
        const rootNode = this.getRootNode();
        if (rootNode.querySelectorAll) {
            rootNode.querySelectorAll('.panel, #list-container').forEach((el) => { el.inert = value; });
        }
    }

    renderStructure() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="css/styles.css">

            <div class="modal" id="modal" hidden>
                <div class="modal-contenido" role="dialog" aria-modal="true" aria-labelledby="titulo-importar">
                    <h2 id="titulo-importar">Importar tareas</h2>

                    <label for="buscar">Buscar en el banco de tareas</label>
                    <input type="search" id="buscar" placeholder="Buscar..." autocomplete="off">

                    <label for="import-category">Categoría para las tareas importadas (opcional)</label>
                    <select id="import-category" class="select-categoria">
                        <option value="">— Sin categoría —</option>
                    </select>

                    <p id="estado" class="estado-carga" role="status"></p>

                    <div class="tarea-importar">
                        <input type="checkbox" id="seleccionar-todas">
                        <label for="seleccionar-todas">Seleccionar todas las visibles</label>
                    </div>

                    <div class="lista-importar" id="lista-importar"></div>
                    <p id="sin-resultados" class="estado-carga" hidden>Ninguna tarea coincide con la búsqueda.</p>

                    <div class="modal-acciones">
                        <button type="button" id="reintentar" hidden>Reintentar</button>
                        <button type="button" id="confirmar" disabled>Importar seleccionadas</button>
                        <button type="button" id="cancelar">Cancelar</button>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('import-modal', ImportModal);
