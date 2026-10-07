/*
 * Textos enriquecidos → texto de ayuda siempre visible en la variable que corresponde (genérico)
 * Por cada etiqueta de texto enriquecido (32) activa del ítem:
 *   - destino = la variable anterior (por orden) que no sea etiqueta; se puede cambiar con DESTINO.
 *   - el texto (sin HTML) va como help_text + show_help + show_help_on_load (+ traducción es),
 *     y la etiqueta se inactiva (no se borra).
 * Además: toda variable del ítem que ya tenga texto de ayuda pero se despliegue con "?" queda siempre visible.
 * Variables de variable sets NO se tocan (se avisan).
 * Revisar en el dry run que cada etiqueta vaya a la variable correcta y las policies que la mostraban.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA DATOS
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var ITEM_ID = '4c1c1c441b004b5058f65425604bcb55';
var DESTINO = {   // opcional: 'nombre_etiqueta': 'nombre_variable_destino'  (o 'omitir')
};

gs.print('DRY_RUN = ' + DRY_RUN);
function plano(html) {
    return String(html || '')
        .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú')
        .replace(/&ntilde;/g, 'ñ').replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í').replace(/&Oacute;/g, 'Ó')
        .replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ').replace(/&iquest;/g, '¿').replace(/&iexcl;/g, '¡').replace(/&uuml;/g, 'ü')
        .replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').replace(/^\s+|\s+$/g, '');
}
function trRec(id, field) {
    var t = new GlideRecord('sys_translated_text');
    t.addQuery('tablename', 'item_option_new'); t.addQuery('documentkey', id); t.addQuery('fieldname', field); t.addQuery('language', 'es'); t.query();
    return t.next() ? t : null;
}
// policies que muestran/ocultan cada variable (para comparar etiqueta vs destino)
var POLS = {};
var pa = new GlideRecord('catalog_ui_policy_action'); pa.addQuery('ui_policy.catalog_item', ITEM_ID); pa.addQuery('ui_policy.active', true); pa.addQuery('visible', '!=', 'ignore'); pa.query();
while (pa.next()) { var k = (pa.getValue('catalog_variable') || '').replace('IO:', ''); (POLS[k] = POLS[k] || []).push(pa.ui_policy.short_description + ' (visible=' + pa.getValue('visible') + ')'); }

// variables del ítem en orden
var lista = [];
var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.addActiveQuery(); v.orderBy('order'); v.query();
while (v.next()) lista.push({ id: v.getUniqueValue(), name: v.getValue('name'), type: v.getValue('type'), order: v.getValue('order'), text: v.getValue('question_text') });
var porNombre = {}; lista.forEach(function (x) { porNombre[x.name] = x; });
var sets = new GlideRecord('io_set_item'); sets.addQuery('sc_cat_item', ITEM_ID); sets.query();
if (sets.getRowCount()) gs.print('(el ítem tiene ' + sets.getRowCount() + ' variable set(s): sus etiquetas no se tocan)');

var n = 0;
lista.forEach(function (lab, i) {
    if (lab.type != '32') return;
    n++;
    var r = new GlideRecord('item_option_new'); r.get(lab.id);
    var txt = plano(r.getValue('rich_text'));
    var trR = trRec(lab.id, 'rich_text'), txtEs = trR ? plano(trR.getValue('value')) : '';
    var prev = null, next = null;
    for (var a = i - 1; a >= 0; a--) if (lista[a].type != '32' && lista[a].type != '24' && lista[a].type != '19' && lista[a].type != '20') { prev = lista[a]; break; }
    for (var b = i + 1; b < lista.length; b++) if (lista[b].type != '32' && lista[b].type != '24' && lista[b].type != '19' && lista[b].type != '20') { next = lista[b]; break; }
    var dest = DESTINO[lab.name] ? (DESTINO[lab.name] == 'omitir' ? null : porNombre[DESTINO[lab.name]]) : prev;

    gs.print('\n[' + lab.order + '] ' + lab.name);
    gs.print('   texto: "' + txt.replace(/\n/g, ' / ') + '"' + (txtEs && txtEs != txt ? '\n   es: "' + txtEs.replace(/\n/g, ' / ') + '"' : ''));
    gs.print('   anterior: ' + (prev ? '[' + prev.order + '] ' + prev.name + ' "' + prev.text + '"' : '-') + ' | siguiente: ' + (next ? '[' + next.order + '] ' + next.name + ' "' + next.text + '"' : '-'));
    gs.print('   policies etiqueta: ' + (POLS[lab.id] || ['(ninguna)']).join('; '));
    if (DESTINO[lab.name] == 'omitir') { gs.print('   → OMITIDA (DESTINO)'); return; }
    if (!dest) { gs.print('   ❌ sin destino (definirlo en DESTINO)'); return; }
    gs.print('   policies destino: ' + (POLS[dest.id] || ['(ninguna)']).join('; '));
    if (!txt) { gs.print('   ⚠️ etiqueta sin texto: solo se inactiva'); }

    var d = new GlideRecord('item_option_new'); d.get(dest.id);
    var ayuda = d.getValue('help_text') ? d.getValue('help_text') + '\n' + txt : txt;
    gs.print('   → ayuda de ' + dest.name + (d.getValue('help_text') ? ' (ya tenía: "' + d.getValue('help_text') + '", se agrega)' : '') + ' | etiqueta → inactiva');
    if (DRY_RUN) return;
    if (txt) {
        d.setValue('help_text', ayuda); d.setValue('show_help', true);
        if (d.isValidField('show_help_on_load')) d.setValue('show_help_on_load', true);
        d.update();
        var tEs = trRec(dest.id, 'help_text'), base = tEs ? tEs.getValue('value') + '\n' : '';
        var valEs = base + (txtEs || txt);
        if (tEs) { tEs.setValue('value', valEs); tEs.update(); }
        else {
            tEs = new GlideRecord('sys_translated_text'); tEs.initialize();
            tEs.setValue('tablename', 'item_option_new'); tEs.setValue('documentkey', dest.id); tEs.setValue('fieldname', 'help_text');
            tEs.setValue('language', 'es'); tEs.setValue('value', valEs); tEs.insert();
        }
    }
    r.setValue('active', false); r.update();
});
if (!n) gs.print('\n(no hay etiquetas de texto enriquecido activas en el ítem)');

// Ayudas que hoy se despliegan con "?" → siempre visibles
gs.print('\n--- Ayudas existentes que no se ven al cargar');
var h = new GlideRecord('item_option_new'); h.addQuery('cat_item', ITEM_ID); h.addActiveQuery(); h.addNotNullQuery('help_text'); h.orderBy('order'); h.query();
var hn = 0;
while (h.next()) {
    if (h.getValue('type') == '32') continue;
    var visible = h.getValue('show_help') == '1' && (!h.isValidField('show_help_on_load') || h.getValue('show_help_on_load') == '1');
    if (visible) continue;
    hn++;
    gs.print('   • [' + h.getValue('order') + '] ' + h.getValue('name') + ' | show_help=' + h.getValue('show_help') +
        (h.isValidField('show_help_on_load') ? ' show_help_on_load=' + h.getValue('show_help_on_load') : '') + ' → visible | "' + h.getValue('help_text').replace(/\n/g, ' / ') + '"');
    if (!DRY_RUN) { h.setValue('show_help', true); if (h.isValidField('show_help_on_load')) h.setValue('show_help_on_load', true); h.update(); }
}
if (!hn) gs.print('   (ninguna)');
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
