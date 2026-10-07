/*
 * Diagnóstico de catálogo (genérico) — cambiar ITEM_ID
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada, no necesita update set)
 * Saca: variables (ítem + sets) con tipo, referencia / lookup, default, ayuda, read-only,
 * opciones con traducción es, policies con condiciones IO: traducidas y sus acciones,
 * client scripts con código, Script Includes que llaman (GlideAjax) y Flow
 * (pasos, variables que usa, variables que no usa y otros catálogos con el mismo Flow).
 * También: descripción del ítem (base y es), adjuntos del ítem y contenido de las etiquetas de texto enriquecido.
 */
var ITEM_ID = '716b40cf1b5ffad058f65425604bcb17';   // Gestión de cuenta en servidores Windows Pre-productivo
var PRINT_CODE = true;

var MAP = {};   // sys_id variable -> name
var AJAX = {};  // Script Includes llamados por GlideAjax
function trEs(text) {
    var t = new GlideRecord('sys_translated');
    t.addQuery('name', 'question_choice'); t.addQuery('element', 'text');
    t.addQuery('value', text); t.addQuery('language', 'es'); t.query();
    return t.next() ? t.getValue('label') : '';
}
function trTxt(table, id, field) {
    var t = new GlideRecord('sys_translated_text');
    t.addQuery('tablename', table); t.addQuery('documentkey', id);
    t.addQuery('fieldname', field); t.addQuery('language', 'es'); t.query();
    return t.next() ? t.getValue('value') : '';
}
function traducir(cond) {
    return (cond || '').replace(/IO:([0-9a-f]{32})/g, function (m, id) { return MAP[id] || m; });
}
function printVar(v, origen) {
    var id = v.getUniqueValue();
    var q = v.getValue('question_text');
    var qEs = trTxt('item_option_new', id, 'question_text');
    gs.print('  [' + v.getValue('order') + '] ' + v.getValue('name') + ' | ' + v.getDisplayValue('type') +
        ' (' + v.getValue('type') + ')' + (v.getValue('mandatory') == '1' ? ' | OBLIG' : '') +
        (v.getValue('active') == '1' ? '' : ' | INACTIVA') + ' | ' + origen);
    gs.print('      texto: "' + q + '"' + (qEs && qEs != q ? '  → es: "' + qEs + '"' : ''));
    if (v.getValue('default_value')) gs.print('      default: ' + v.getValue('default_value'));
    if (v.getValue('type') == '14') gs.print('      widget: ' + v.getDisplayValue('sp_widget'));
    if (v.getValue('reference')) gs.print('      referencia: ' + v.getValue('reference') + (v.getValue('reference_qual') ? ' | qual: ' + v.getValue('reference_qual') : '') +
        (v.isValidField('use_reference_qualifier') ? ' (' + v.getValue('use_reference_qualifier') + ')' : ''));
    if (v.isValidField('lookup_table') && v.getValue('lookup_table')) gs.print('      lookup: ' + v.getValue('lookup_table') +
        ' | value=' + v.getValue('lookup_value') + ' | label=' + v.getValue('lookup_label'));
    if (v.getValue('attributes')) gs.print('      attributes: ' + v.getValue('attributes'));
    if (v.isValidField('read_only') && v.getValue('read_only') == '1') gs.print('      SOLO LECTURA (variable)');
    if (v.getValue('help_text')) gs.print('      ayuda: ' + v.getValue('help_text') + (v.isValidField('show_help') ? ' (show_help=' + v.getValue('show_help') + ')' : ''));
    if (v.isValidField('example_text') && v.getValue('example_text')) gs.print('      texto de ejemplo: ' + v.getValue('example_text'));
    if (v.isValidField('rich_text') && v.getValue('rich_text')) gs.print('      rich_text: ' + v.getValue('rich_text'));
    var c = new GlideRecord('question_choice');
    c.addQuery('question', id); c.orderBy('order'); c.query();
    while (c.next()) {
        var txt = c.getValue('text'), es = trEs(txt);
        gs.print('      • ' + c.getValue('value') + ' = "' + txt + '"' + (es ? '  → es: "' + es + '"' : '') +
            (txt && txt.indexOf('\u200B') > -1 ? '  [\\u200B]' : '') + (c.getValue('inactive') == '1' ? ' (inactiva)' : ''));
    }
}

var item = new GlideRecord('sc_cat_item');
if (!item.get(ITEM_ID)) { gs.print('❌ No existe el ítem'); }
else {
    gs.print('=== ' + item.getValue('name') + ' (' + ITEM_ID + ')');
    gs.print('Flow: ' + item.getDisplayValue('flow_designer_flow') + ' | Workflow: ' + item.getDisplayValue('workflow'));
    gs.print('\n--- DESCRIPCIÓN (base)\n' + item.getValue('description'));
    var dEs = trTxt('sc_cat_item', ITEM_ID, 'description');
    gs.print('--- DESCRIPCIÓN (es)\n' + (dEs || '(sin traducción)'));
    gs.print('\n--- ADJUNTOS DEL ÍTEM');
    var att = new GlideRecord('sys_attachment'); att.addQuery('table_name', 'sc_cat_item'); att.addQuery('table_sys_id', ITEM_ID); att.query();
    if (!att.hasNext()) gs.print('(ninguno)');
    while (att.next()) gs.print('• ' + att.getValue('file_name') + ' | ' + att.getUniqueValue() + ' | ' + att.getValue('size_bytes') + ' bytes');

    // Mapa de nombres (ítem + sets) para traducir condiciones
    var sets = [];
    var s = new GlideRecord('io_set_item'); s.addQuery('sc_cat_item', ITEM_ID); s.orderBy('order'); s.query();
    while (s.next()) sets.push({ id: s.getValue('variable_set'), name: s.getDisplayValue('variable_set'), order: s.getValue('order') });
    var m = new GlideRecord('item_option_new'); var qc = m.addQuery('cat_item', ITEM_ID);
    for (var i = 0; i < sets.length; i++) qc.addOrCondition('variable_set', sets[i].id);
    m.query(); while (m.next()) MAP[m.getUniqueValue()] = m.getValue('name');

    gs.print('\n--- VARIABLES DEL ÍTEM');
    var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.orderBy('order'); v.query();
    while (v.next()) printVar(v, 'ítem');

    gs.print('\n--- SETS');
    for (var j = 0; j < sets.length; j++) {
        gs.print('SET "' + sets[j].name + '" | io_set_item.order = ' + sets[j].order);
        var sv = new GlideRecord('item_option_new'); sv.addQuery('variable_set', sets[j].id); sv.orderBy('order'); sv.query();
        while (sv.next()) printVar(sv, 'set');
    }

    gs.print('\n--- UI POLICIES DEL ÍTEM');
    var p = new GlideRecord('catalog_ui_policy'); p.addQuery('catalog_item', ITEM_ID); p.orderBy('order'); p.query();
    while (p.next()) {
        gs.print('[' + p.getValue('order') + '] ' + p.getValue('short_description') + (p.getValue('active') == '1' ? '' : ' (INACTIVA)') +
            ' | onLoad=' + p.getValue('on_load') + ' invertir=' + p.getValue('reverse_if_false') +
            ' | cat=' + p.getValue('applies_catalog') + ' ritm=' + p.getValue('applies_req_item') + ' task=' + p.getValue('applies_sc_task'));
        gs.print('    cond: ' + traducir(p.getValue('catalog_conditions')));
        var a = new GlideRecord('catalog_ui_policy_action'); a.addQuery('ui_policy', p.getUniqueValue()); a.query();
        while (a.next()) gs.print('    → ' + traducir(a.getValue('catalog_variable')) + ' | visible=' + a.getValue('visible') +
            ' oblig=' + a.getValue('mandatory') + ' solo_lect=' + a.getValue('disabled') +
            (a.getValue('value_action') == 'clearValue' ? ' | BORRAR VALOR' : ''));
    }

    gs.print('\n--- CLIENT SCRIPTS DEL ÍTEM');
    var cs = new GlideRecord('catalog_script_client'); cs.addQuery('cat_item', ITEM_ID); cs.query();
    while (cs.next()) {
        gs.print('• ' + cs.getValue('name') + ' | ' + cs.getValue('type') +
            (cs.getValue('cat_variable') ? ' | var=' + traducir(cs.getValue('cat_variable')) : '') +
            (cs.getValue('active') == '1' ? '' : ' (INACTIVO)'));
        if (PRINT_CODE) gs.print(cs.getValue('script') + '\n');
        var ga = (cs.getValue('script') || '').match(/GlideAjax\(\s*['"]([^'"]+)['"]/g) || [];
        ga.forEach(function (x) { AJAX[x.replace(/GlideAjax\(\s*['"]|['"]/g, '')] = true; });
    }

    gs.print('\n--- SCRIPT INCLUDES LLAMADOS (GlideAjax)');
    for (var si in AJAX) {
        var inc = new GlideRecord('sys_script_include'); inc.addQuery('name', si); inc.query();
        if (!inc.next()) { gs.print('❌ ' + si + ' no existe'); continue; }
        gs.print('• ' + si + ' | client callable=' + inc.getValue('client_callable') + ' | activo=' + inc.getValue('active'));
        if (PRINT_CODE) gs.print(inc.getValue('script') + '\n');
    }
}

// ================= FLOW =================
gs.print('\n--- FLOW');
(function () {
var it = new GlideRecord('sc_cat_item'); it.get(ITEM_ID);
var flowId = it.getValue('flow_designer_flow');
if (!flowId) { gs.print('(el ítem no tiene Flow de Flow Designer)'); return; }
gs.print('Flow: ' + it.getDisplayValue('flow_designer_flow') + ' (' + flowId + ')');
var otros = new GlideRecord('sc_cat_item'); otros.addQuery('flow_designer_flow', flowId); otros.addQuery('sys_id', '!=', ITEM_ID); otros.query();
gs.print('Otros catálogos con este Flow: ' + (otros.getRowCount() || 'ninguno'));
while (otros.next()) gs.print('  • ' + otros.getValue('name') + ' (' + otros.getUniqueValue() + ')' + (otros.getValue('active') == '1' ? '' : ' (inactivo)'));

// variables del ítem (y de sus sets)
var VARS = {}, ACTIVAS = {};
function addVar(v) { VARS[v.getUniqueValue()] = v.getValue('name'); if (v.getValue('active') == '1') ACTIVAS[v.getValue('name')] = true; }
var v = new GlideRecord('item_option_new'); v.addQuery('cat_item', ITEM_ID); v.query(); while (v.next()) addVar(v);
var s = new GlideRecord('io_set_item'); s.addQuery('sc_cat_item', ITEM_ID); s.query();
while (s.next()) { var sv = new GlideRecord('item_option_new'); sv.addQuery('variable_set', s.getValue('variable_set')); sv.query(); while (sv.next()) addVar(sv); }

// flow + snapshots publicados
var ids = [flowId], f = new GlideRecord('sys_hub_flow');
if (f.get(flowId)) {
    gs.print('Estado: ' + f.getDisplayValue('status') + ' | activo: ' + f.getValue('active'));
    ['latest_snapshot', 'master_snapshot'].forEach(function (fld) {
        if (f.isValidField(fld) && f.getValue(fld) && ids.indexOf(f.getValue(fld)) == -1) ids.push(f.getValue(fld));
    });
}

var USADAS = {};
function leer(gr) {
    var raw = gr.getValue('values') || '';
    if (raw.indexOf('H4sI') != 0) return raw;   // no comprimido: evita el EOFException de Java
    try { return GlideCompressionUtil.expandToString(GlideStringUtil.base64DecodeAsBytes(raw)); } catch (e) { return raw; }
}
ids.forEach(function (id) {
    gs.print('\n=== ' + (id == flowId ? 'FLOW' : 'SNAPSHOT') + ' ' + id);
    ['sys_hub_action_instance_v2', 'sys_hub_flow_logic_instance_v2', 'sys_hub_sub_flow_instance_v2'].forEach(function (t) {
        var a = new GlideRecord(t);
        if (!a.isValid()) return;
        a.addQuery('flow', id); a.orderBy('order'); a.query();
        while (a.next()) {
            var txt = leer(a), usa = [];
            for (var sid in VARS) if (txt.indexOf(sid) > -1 || txt.indexOf(VARS[sid]) > -1) { usa.push(VARS[sid]); USADAS[VARS[sid]] = true; }
            var tipo = a.isValidField('action_type') ? a.getDisplayValue('action_type') :
                       a.isValidField('logic_definition') ? a.getDisplayValue('logic_definition') : t;
            gs.print('[' + a.getValue('order') + '] ' + tipo + (a.getValue('comment') ? ' — ' + a.getValue('comment') : ''));
            if (usa.length) gs.print('     variables: ' + usa.join(', '));
            if (/catalog_task|Catalog Task|Tarea de catálogo/i.test(tipo + txt)) gs.print('     (paso de tarea de catálogo)');
        }
    });
});

gs.print('\n--- VARIABLES ACTIVAS QUE EL FLOW NO MENCIONA');
var nada = true;
for (var n in ACTIVAS) if (!USADAS[n]) { gs.print('• ' + n); nada = false; }
if (nada) gs.print('(ninguna)');
})();
gs.print('\nFIN (solo lectura)');
