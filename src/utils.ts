import * as path from 'path';
import * as vscode from 'vscode';


interface WordupCliCmd {
	dir: string; 
	cmd: string; 
	origCmd: string;
}

export function wordupCliSetup(extensionPath:string, cmd:string): WordupCliCmd {
    const wpCliCmd = {
        cmd:path.join('.','bin', 'run')+' '+cmd,
        dir:path.join(extensionPath,'node_modules','wordup-cli'),
        origCmd:'wordup '+cmd
    };

    if(process.platform === 'win32'){
        wpCliCmd.cmd = path.join('.','bin', 'run.cmd')+' '+cmd;   
    } 
    return wpCliCmd;
}


let _channel: vscode.OutputChannel;
export function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Wordup');
	}
	return _channel;
}