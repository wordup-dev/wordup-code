import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';

import { WordupInitWebView } from './webview/wordupInit';

const shell = require('shelljs');
const Configstore = require('configstore');

interface ProjectRootData {
	id: string; 
	name: string; 
	slugName:string;
	path:string;
	installedOnPort:string;
	listeningOnPort:string;
}

interface ProjectInfoData {
	id: string; 
	name: string; 
	port: string;
	path:string;
	projectName:string;
}

interface ProjectNode {
	data: ProjectRootData | ProjectInfoData;
}

const fastSelectShowItem: vscode.QuickPickItem  = {label:'Show current project in explorer'};
const fastSelectOpenItem: vscode.QuickPickItem  = {label:'Open current project in browser'};
const fastSelectTasks: vscode.QuickPickItem  = {label:'Show wordup tasks (e.g. export)'};
const fastSelectStartItem: vscode.QuickPickItem  = {label:'Start new project'};


async function checkPackageUpdate(){
	
	const notifierConfig = new Configstore('update-notifier-wordup-cli');
	if(notifierConfig.size > 0){
		if(notifierConfig.has('update')){
			vscode.window.showInformationMessage('There is an update ('+notifierConfig.get('update.latest')+') available for [wordup-cli](https://www.npmjs.com/package/wordup-cli)', ...['Install']).then(selection => {
				if(selection === 'Install'){
					const terminal = vscode.window.createTerminal();
					terminal.sendText('npm install -g wordup-cli', false);
					terminal.show(true);
				}
			});
		}
	}
}

export function isRootData(object: any): object is ProjectRootData {
    return 'slugName' in object;
}

export class WordupProjectView {

	private projectExplorer: vscode.TreeView<ProjectNode>;
	public projects: ProjectNodeProvider;


	constructor(context: vscode.ExtensionContext) {


		this.projects = new ProjectNodeProvider(context);
		
		this.projectExplorer = vscode.window.createTreeView('wordupProjectView', { treeDataProvider: this.projects, showCollapseAll: false });

		this.projectExplorer.onDidChangeVisibility(e => {
        	//console.log( this.projectExplorer.visible);
    	});

		vscode.commands.registerCommand('wordup.fastSelect', async (selected?:vscode.QuickPickItem) => {

			if(!selected){
				selected = await vscode.window.showQuickPick([fastSelectShowItem,fastSelectOpenItem,fastSelectTasks,fastSelectStartItem],{ 
					canPickMany:false
				});
			}

			if(selected === fastSelectShowItem || selected === fastSelectOpenItem){

				const defaultPath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.path : '';
				if(defaultPath){
					const element = await this.findProjectByPath(defaultPath);
					
					if(element){
						if(selected === fastSelectShowItem){
							await this.projectExplorer.reveal(element, { focus: true, select: false, expand: true });
						}else if(isRootData(element.data)){
							if(element.data.listeningOnPort){
								vscode.env.openExternal(vscode.Uri.parse('http://localhost:'+element.data.listeningOnPort));
							}else {
								vscode.window.showInformationMessage('Project server is not running');
							}
						}
					}
				}
			}else if(selected === fastSelectTasks){
				vscode.commands.executeCommand('workbench.action.tasks.runTask');
			}else if(selected === fastSelectStartItem){
				vscode.commands.executeCommand('wordupProjectView.addEntry');
			}
		});


		vscode.commands.registerCommand('wordupProjectView.refreshEntry', () => this.projects.refresh());
		vscode.commands.registerCommand('wordupProjectView.editEntry', (node: any) => {
			if(node && isRootData(node.data)){
				vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(node.data.path), true);
				vscode.window.showInformationMessage(`Opened wordup project: ${node.data.name}.`);
			}

		});

		vscode.commands.registerCommand('wordupProjectView.addEntry', async () => {
			const wordupInitForm = new WordupInitWebView(context);
		});


		vscode.commands.registerCommand('wordup.openInBrowser', async (node:any) =>  {
			if(node){
				vscode.env.openExternal(vscode.Uri.parse('http://localhost:'+node.data.port));
			}else{
				vscode.commands.executeCommand('wordup.fastSelect', fastSelectOpenItem);
			}
		});
		

	}


	public async findProjectByPath(aPath:string):Promise<ProjectNode | undefined>  {
		const id = crypto.createHash('sha1').update(aPath).digest('hex');
		let allProjects = this.projects.cachedProjects;

		if(allProjects.length === 0){
			allProjects = await this.projects.getChildren();
		}

		const project = allProjects.find((element:ProjectNode) => {
			return (element.data.id === id);
		});

		return Promise.resolve(project);
	}

	public async runningProjects(port?:string):Promise<ProjectNode | undefined>  {
		let allProjects = this.projects.cachedProjects;

		if(allProjects.length === 0){
			allProjects = await this.projects.getChildren();
		}

		const runningProject = allProjects.find((element:ProjectNode) => {
			if(isRootData(element.data)){
				if(port){
					if(port === element.data.listeningOnPort){
						return true;
					}
				}else if(element.data.listeningOnPort){
					return true;
				}
			}
			return false;
		});
		return Promise.resolve(runningProject);
	}


}

export class ProjectNodeProvider implements vscode.TreeDataProvider<ProjectNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<ProjectNode | undefined> = new vscode.EventEmitter<ProjectNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<ProjectNode | undefined> = this._onDidChangeTreeData.event;

	public cachedProjects:ProjectNode[] = [];
	readonly extensionPath:string;


	constructor(context: vscode.ExtensionContext) {
		this.extensionPath = context.extensionPath;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element:ProjectNode): vscode.TreeItem {
		if(isRootData(element.data)){

			const wordupUri = vscode.Uri.file('/wordup/project#/'+element.data.id);

			const status = [];
			if(element.data.installedOnPort){
				status.push('Installed');
			}
			if(element.data.listeningOnPort){
				status.push('Running');
			}

			return {
				label:element.data.name,
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				description: status.length > 0 ? '✔ '+status.join(' & ') : '',
				tooltip:'Slug: '+element.data.slugName,
				contextValue:'project',
				resourceUri:wordupUri,
				iconPath:{
					light: path.join(this.extensionPath, 'resources', 'light', 'project.svg'),
					dark: path.join(this.extensionPath, 'resources', 'dark', 'project.svg')
				}
			};
		}else{

			return {
				label: element.data.name,
				collapsibleState: vscode.TreeItemCollapsibleState.None,
				contextValue:element.data.id
			};

		}


	}


	getChildren(element?:ProjectNode):ProjectNode[] | Thenable<ProjectNode[]> {

		if (element) {
			if(isRootData(element.data)){
				return this.getProjectInfo(element.data);
			}
			return Promise.resolve([]);
		} else {
			return Promise.resolve(this.getProjects());
			
		}

	}

	getParent(element:ProjectNode) {
		return null;
	}

	private getProjects(): Promise<ProjectNode[]> {
		this.cachedProjects = [];

		return new Promise((resolve, reject) => {


			if(!shell.which('wordup')){
				vscode.window.showInformationMessage('We could not find the [wordup-cli](https://www.npmjs.com/package/wordup-cli) package on your system', ...['Install']).then(selection => {
					if(selection === 'Install'){
						const terminal = vscode.window.createTerminal();
						terminal.sendText('npm install -g wordup-cli',false);
        				terminal.show(true);
					}
				});
				resolve([]);
			}else{
				checkPackageUpdate();
			}

			shell.exec('wordup list --json --clear', {cwd:this.extensionPath}, (code:number, stdout: string, stderr: string) => {
				const wordup_list = JSON.parse(stdout);
				let plist:ProjectNode[] = [];
				wordup_list.forEach((element: ProjectRootData) => {
					//const newProject = new Project(element.name, element, vscode.TreeItemCollapsibleState.Collapsed);
					const newProject: ProjectNode = {data:element};
					this.cachedProjects.push(newProject);
					plist.push(newProject);
				});
				resolve(plist);
			});
			
		});
	}

	private getProjectInfo(element: ProjectRootData):ProjectNode[] {
		let name = 'Server: http://localhost:'+element.listeningOnPort;
		let context = 'projectRunning';

		if(!element.installedOnPort){
			name = 'Server: Not installed';
			context = 'projectStopped';
		}else if(!element.listeningOnPort){
			name = 'Server: Paused';
			context = 'projectPaused';
		}

		const info: ProjectInfoData = {
			id: context,
			name:name,
			port:element.listeningOnPort || element.installedOnPort,
			path:element.path,
			projectName:element.name
		};

		return [{data:info}];
	}


}