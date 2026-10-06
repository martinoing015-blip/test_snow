/*
 * ¿Qué se rompe si le cambio el nombre a un catálogo?
 * Busca el nombre actual (base y traducción es) como TEXTO en scripts, condiciones,
 * notificaciones, SLA, reportes, propiedades y Flows. Lo que apunta por sys_id no se rompe.
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada)
 */
var ITEM_ID = 'eeb095361b1336d0d4f1a756624bcb21';   // Gestión VPN para Colaborador Interno (verificar)

var it = new GlideRecord('sc_cat_item');
if (!it.get(ITEM_ID)) { gs.print('❌ No existe el ítem ' + ITEM_ID); }
else {
    var NOMBRES = [it.getValue('name')];
    var tr = new GlideRecord('sys_translated_text');
    tr.addQuery('tablename', 'sc_cat_item'); tr.addQuery('documentkey', ITEM_ID); tr.addQuery('fieldname', 'name'); tr.addQuery('language', 'es'); tr.query();
    var nombreEs = tr.next() ? tr.getValue('value') : '';
    if (nombreEs && NOMBRES.indexOf(nombreEs) == -1) NOMBRES.push(nombreEs);
    gs.print('Catálogo: "' + it.getValue('name') + '" | traducción es: ' + (nombreEs ? '"' + nombreEs + '"' : '(sin traducción)'));
    gs.print('Flow: ' + it.getDisplayValue('flow_designer_flow') + ' | Workflow: ' + it.getDisplayValue('workflow'));

    var DONDE = [
        ['sys_script', ['script', 'condition', 'filter_condition'], 'Business rule'],
        ['sys_script_include', ['script'], 'Script Include'],
        ['sysevent_email_action', ['condition', 'advanced_condition'], 'Notificación'],
        ['sysevent_script_action', ['script'], 'Script action'],
        ['contract_sla', ['start_condition', 'stop_condition', 'pause_condition', 'cancel_condition'], 'SLA'],
        ['sysrule_assignment', ['condition', 'script'], 'Regla de asignación'],
        ['sys_report', ['filter'], 'Reporte'],
        ['catalog_script_client', ['script'], 'Catalog client script'],
        ['sys_script_client', ['script'], 'Client script'],
        ['sys_ui_action', ['script', 'condition'], 'UI action'],
        ['sys_properties', ['value'], 'Propiedad'],
        ['sysauto_script', ['script'], 'Job programado'],
        ['sys_ws_operation', ['operation_script'], 'REST API'],
        ['sys_transform_script', ['script'], 'Transform script']
    ];
    var total = 0;
    NOMBRES.forEach(function (nom) {
        gs.print('\n=== Buscando "' + nom + '"');
        DONDE.forEach(function (d) {
            var g = new GlideRecord(d[0]); if (!g.isValid()) return;
            var qc = null;
            d[1].forEach(function (f) {
                if (!g.isValidField(f)) return;
                if (!qc) qc = g.addQuery(f, 'CONTAINS', nom); else qc.addOrCondition(f, 'CONTAINS', nom);
            });
            if (!qc) return;
            g.query();
            while (g.next()) {
                total++;
                var nm = g.isValidField('name') ? g.getValue('name') : (g.isValidField('title') ? g.getValue('title') : g.getUniqueValue());
                var act = g.isValidField('active') ? (g.getValue('active') == '1' ? '' : ' (inactivo)') : '';
                gs.print('⚠️ ' + d[2] + ': ' + nm + act + ' [' + d[0] + ' ' + g.getUniqueValue() + ']');
            }
        });
        // Flows (values comprimidos)
        ['sys_hub_action_instance_v2', 'sys_hub_flow_logic_instance_v2', 'sys_hub_trigger_instance_v2'].forEach(function (t) {
            var a = new GlideRecord(t); if (!a.isValid()) return;
            a.query();
            while (a.next()) {
                var txt = '';
                try { txt = GlideCompressionUtil.expandToString(GlideStringUtil.base64DecodeAsBytes(a.getValue('values'))); } catch (e) { txt = a.getValue('values') || ''; }
                if (txt.indexOf(nom) > -1) { total++; gs.print('⚠️ Flow: ' + a.getDisplayValue('flow') + ' [' + t + ' ' + a.getUniqueValue() + ']'); }
            }
        });
    });
    gs.print('\nUsos del nombre como texto: ' + total + (total ? ' → revisar cada uno antes de renombrar' : ' → se puede renombrar (actualizar también la traducción es)'));
}
gs.print('FIN (solo lectura)');
