import React from 'react';
import { MOCK_DASHBOARD_DATA } from './dashboard-data';

export default function Dashboard() {
  const data = MOCK_DASHBOARD_DATA;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Novel Engine</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Current Novel: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{data.currentNovel.title}</span></p>
        </div>
        <div className="flex gap-3">
          <select 
            aria-label="Select Novel"
            className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>{data.currentNovel.title}</option>
            <option>Create New Novel...</option>
          </select>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors">
            Generate Next
          </button>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Pipeline & Cost */}
        <div className="col-span-1 lg:col-span-3 flex flex-col gap-6">
          <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Generation Pipeline</h2>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Status</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                {data.pipelineStatus.health}
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress (Ch {data.currentNovel.currentChapter}/{data.currentNovel.targetChapters})</span>
                  <span>{Math.round(data.pipelineStatus.progress * 100)}%</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${data.pipelineStatus.progress * 100}%` }}></div>
                </div>
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <p>Current Step: <strong className="text-zinc-900 dark:text-zinc-100">{data.pipelineStatus.step}</strong></p>
                <p>Active Tasks: {data.pipelineStatus.activeTasks}</p>
                <p>Queued Tasks: {data.pipelineStatus.queuedTasks}</p>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Cost</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Total Tokens</span>
                <span className="font-mono">{data.costMetrics.totalTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Est. Cost</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">${data.costMetrics.estimatedCostUsd.toFixed(2)}</span>
              </div>
              <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Model: {data.costMetrics.model} ({data.costMetrics.provider})</p>
              </div>
            </div>
          </section>
        </div>

        {/* Main Content Column */}
        <div className="col-span-1 lg:col-span-9 flex flex-col gap-6">
          
          {/* Top Row in Main */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Story Bible</h2>
                <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
              </div>
              <p className="text-sm italic mb-3 text-zinc-700 dark:text-zinc-300">&quot;{data.storyBible.premise}&quot;</p>
              <div className="text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
                <p><span className="font-medium text-zinc-900 dark:text-zinc-100">Tone:</span> {data.storyBible.tone}</p>
                <p><span className="font-medium text-zinc-900 dark:text-zinc-100">World Rules:</span> {data.storyBible.worldRules} defined</p>
                <p><span className="font-medium text-zinc-900 dark:text-zinc-100">Factions:</span> {data.storyBible.factions} active</p>
              </div>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm overflow-hidden">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Characters</h2>
              <div className="space-y-2">
                {data.characters.map((char, i) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b border-zinc-100 dark:border-zinc-800 pb-2 last:border-0 last:pb-0">
                    <div>
                      <span className="font-medium">{char.name}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">{char.role}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${char.status === 'alive' ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {char.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Arcs and Chapters */}
          <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Arcs & Chapters</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {data.arcs.map((arc, i) => (
                <div key={i} className="border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
                  <h3 className="font-medium text-sm mb-1">{arc.title}</h3>
                  <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{arc.chapters} chapters</span>
                    <span className={`${arc.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>{arc.status}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Recent Chapters</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 uppercase border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-2 font-medium">Ch.</th>
                    <th className="px-4 py-2 font-medium">Title</th>
                    <th className="px-4 py-2 font-medium">Words</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentChapters.map((ch, i) => (
                    <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                      <td className="px-4 py-3 text-zinc-500">{ch.chapterNumber}</td>
                      <td className="px-4 py-3 font-medium">{ch.title}</td>
                      <td className="px-4 py-3 text-zinc-500">{ch.words.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          ch.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {ch.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Continuity Issues */}
          <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Continuity & Errors</h2>
              <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-medium">{data.continuityIssues.length} open</span>
            </div>
            <div className="space-y-3">
              {data.continuityIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-3 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-800">
                  <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${issue.severity === 'major' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                  <div className="flex-1">
                     <p className="text-sm">{issue.description}</p>
                     <div className="mt-2 flex gap-2">
                       <button className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Repair Prompt</button>
                       <button className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Dismiss</button>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
