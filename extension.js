import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { createStatusIndicator, refreshCpuValue, refreshMemoryValue } from './utils.js';

const statusIndicatorId = 'cpu-mem-status-indicator';

export default class CpuMemoryUsageExtension extends Extension {

    enable() {
        this._statusIndicator = createStatusIndicator(this);
        Main.panel.addToStatusArea(statusIndicatorId, this._statusIndicator, 0, 'right');

        refreshCpuValue();
        refreshMemoryValue();
        this._sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            refreshCpuValue();
            refreshMemoryValue()
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        Main.panel.statusArea[statusIndicatorId]?.destroy();

        if (this._sourceId) {
            GLib.Source.remove(this._sourceId);
            this._sourceId = null;
        }
    }
}