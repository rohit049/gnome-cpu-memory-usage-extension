import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

let cpuLabel, memoryLabel;
let prevTotalCpu = 0;
let prevIdleCpu = 0;

const decoder = new TextDecoder('utf-8');

async function loadFile(path, cancellable = null) {
    const file = Gio.File.new_for_path(path);

    try {
        const contents = await new Promise((resolve, reject) => {
            file.load_contents_async(cancellable, (file, res) => {
                try {
                    const [ok, contents, etag_out] = file.load_contents_finish(res);

                    resolve(contents);
                } catch (e) {
                    reject(e);
                }
            });
        });

        return contents;
    } catch (error) {
        log(`Error loading file (${path}): ${error.message}`);
        throw error; // Rethrow the error to propagate it to the calling function
    }
}

function calculateCpuUsage(contents) {
    const lines = decoder.decode(contents).split('\n');
    const cpuInfo = lines[0].trim().split(/\s+/);

    const userCpu = parseInt(cpuInfo[1]);
    const niceCpu = parseInt(cpuInfo[2]);
    const systemCpu = parseInt(cpuInfo[3]);
    const idleCpu = parseInt(cpuInfo[4]);

    const totalCpu = userCpu + niceCpu + systemCpu + idleCpu;
    const totalCpuDelta = totalCpu - prevTotalCpu;
    const idleCpuDelta = idleCpu - prevIdleCpu;

    const cpuUsage = 100 * (totalCpuDelta - idleCpuDelta) / totalCpuDelta;
    prevTotalCpu = totalCpu;
    prevIdleCpu = idleCpu;

    return cpuUsage;
}

function updateCpuLabel(cpuUsage) {
    const color = cpuUsage > 80 ? '#d32f2f' : '#2e7d32'; // Red or Green
    cpuLabel.get_parent().style = `
        background-color: ${color};
        border-radius: 3px;
    `;
    cpuLabel.style = `font-size: 8pt; color: white; padding: 2px 5px;`;
    cpuLabel.text = `${cpuUsage.toFixed(0)}%`;
}

export async function refreshCpuValue() {
    try {
        const contents = await loadFile('/proc/stat');
        const cpuUsage = calculateCpuUsage(contents);
        updateCpuLabel(cpuUsage);
    } catch (error) {
        log(`Error loading CPU usage: ${error.message}`);
    }
}

function parseMemoryInfo(contents) {
    const lines = decoder.decode(contents).split('\n');
    let total, available;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let values;

        if (line.match(/^MemTotal/)) {
            values = line.match(/^MemTotal:\s*([^ ]*)\s*([^ ]*)$/);
            total = parseInt(values[1]);
        } else if (line.match(/^MemAvailable/)) {
            values = line.match(/^MemAvailable:\s*([^ ]*)\s*([^ ]*)$/);
            available = parseInt(values[1]);
        }

        if (total && available) {
            break;
        }
    }

    return { total, available };
}

function formatMemoryUsage(used, total) {
    const units = ['KB', 'MB', 'GB'];
    let unitIndex = 0;

    while (used >= 1000 && unitIndex < units.length - 1) {
        used /= 1000;
        unitIndex++;
    }

    return `${used.toFixed(2)} ${units[unitIndex]}`;
}

export function refreshMemoryValue() {
    loadFile('/proc/meminfo').then(contents => {
        const { total, available } = parseMemoryInfo(contents);
        const used = total - available;
        const usedPercent = (used / total) * 100;

        const formattedMemory = formatMemoryUsage(used, total);
        const color = usedPercent > 80 ? '#d32f2f' : '#2e7d32'; // Red or Green
        memoryLabel.get_parent().style = `
            background-color: ${color};
            border-radius: 3px;
        `;
        memoryLabel.style = `font-size: 8pt; color: white; padding: 2px 5px;`;
        memoryLabel.text = `${formattedMemory}`;
    }).catch(error => {
        log(`Error loading memory info: ${error.message}`);
    });
}


export function createStatusIndicator(extension) {
    const statusButton = new PanelMenu.Button(0.5, _('CPU & Mem Status Indicator'), false);
    statusButton.track_hover = false;

    const statusBox = new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box', style: 'padding: 4px 0;' });
    statusBox.spacing = 0;

    // CPU Box
    cpuLabel = new St.Label({
        style_class: 'system-status-label',
        y_align: Clutter.ActorAlign.CENTER,
    });
    const cpuBox = new St.BoxLayout({ style_class: 'cpu-box', style: 'padding: 4px 5px;' });
    cpuBox.add_child(cpuLabel);

    // Memory Box
    memoryLabel = new St.Label({
        style_class: 'system-status-label',
        y_align: Clutter.ActorAlign.CENTER,
    });
    const memoryBox = new St.BoxLayout({ style_class: 'memory-box', style: 'padding: 4px 5px;' });
    memoryBox.add_child(memoryLabel);

    statusBox.add_child(cpuBox);
    statusBox.add_child(memoryBox);

    statusButton.add_child(statusBox);

    return statusButton;
}
