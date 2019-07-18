import * as path from 'path';
import * as vscode from 'vscode';


let _channel: vscode.OutputChannel;
export function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Wordup');
	}
	return _channel;
}

export function wordupConformPath(aPath:string): string {
	if(process.platform === "win32"){
		const root = path.parse(aPath).root;
		return path.resolve("/", aPath.replace(root, ""));
	}
	return aPath;
}