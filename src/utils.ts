import * as path from 'path';
import * as vscode from 'vscode';


let _channel: vscode.OutputChannel;
export function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Wordup');
	}
	return _channel;
}