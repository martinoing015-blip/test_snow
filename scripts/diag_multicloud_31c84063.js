/*
 * Diagnóstico — Solicitud Masiva Entorno Multicloud
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada, no necesita update set)
 * Saca: variables (ítem + sets), opciones con traducción es, policies con
 * condiciones IO: traducidas y sus acciones, client scripts.
 */
var ITEM_ID = '31c840631be3325058f65425604bcb53';
var PRINT_CODE = true;

var MAP = {};   // sys_id variable -> name
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
    }
}
gs.print('FIN (solo lectura)');
