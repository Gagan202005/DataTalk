import React, { useState } from 'react';
import { Bot, PanelLeftClose, PanelLeft, LayoutTemplate, FolderGit2, BarChart2, Settings, HelpCircle, LogOut } from 'lucide-react';

export default function LeftNav({ isOpen, onToggle }) {
  const [activeTab, setActiveTab] = useState('AI Chat Helper');

  const navItems = [
    { name: 'AI Chat Helper', icon: Bot, isPro: false },
    { name: 'Templates', icon: LayoutTemplate, isPro: true },
    { name: 'My projects', icon: FolderGit2, isPro: true },
    { name: 'Statistics', icon: BarChart2, isPro: true },
    { name: 'Settings', icon: Settings, isPro: false },
    { name: 'Updates & FAQ', icon: HelpCircle, isPro: false }
  ];

  return (
    <aside
      className={`flex-shrink-0 bg-[#0f0f15] border-r border-[#2a2a4a]/40 flex flex-col transition-all duration-300 ease-in-out relative ${
        isOpen ? 'w-[250px]' : 'w-[80px]'
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-5 bg-[#2a2a4a] rounded-full p-1 border border-[#3a3a5a] text-[#8a8a9a] hover:text-white transition-colors z-10"
      >
        {isOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
      </button>

      {/* Header */}
      <div className="p-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#5b21b6] flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)]">
          <Bot size={18} className="text-white" />
        </div>
        {isOpen && <h1 className="text-lg font-bold text-white tracking-wide font-['Inter']">DataTalk</h1>}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.name}
            onClick={() => setActiveTab(item.name)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
              activeTab === item.name
                ? 'bg-[#252535] text-white font-medium'
                : 'text-[#8a8a9a] hover:bg-[#1a1a25] hover:text-[#d0d0e0]'
            }`}
          >
            <item.icon
              size={18}
              className={`${
                activeTab === item.name
                  ? 'text-[#8b5cf6]'
                  : 'text-[#8a8a9a] group-hover:text-[#a0a0b0]'
              }`}
            />
            {isOpen && (
              <>
                <span className="flex-1 text-left">{item.name}</span>
                {item.isPro && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-[#2a2a4a] text-[#6a6a8a] group-hover:text-[#8a8a9a] group-hover:border-[#3a3a5a]">
                    Pro
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      {/* Pro Plan Banner */}
      {isOpen && (
        <div className="mx-4 mb-4 mt-auto rounded-xl bg-gradient-to-br from-[#4b3588] via-[#2a1b4d] to-[#0f0f15] border border-[#5b21b6]/30 p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#8b5cf6]/20 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
          <h3 className="text-white font-bold text-sm mb-1 relative z-10">Pro Plan</h3>
          <p className="text-[#a0a0b0] text-[10px] mb-3 relative z-10">
            Strengthen artificial intelligence: get pro!
          </p>
          <div className="text-white text-lg font-bold mb-3 relative z-10">
            $10 <span className="text-[10px] text-[#8a8a9a] font-normal">/ mo</span>
          </div>
          <button className="w-full bg-white text-black text-xs font-bold py-2 rounded-lg hover:bg-gray-100 transition-colors relative z-10">
            Get PRO
          </button>
        </div>
      )}

      {/* Logout */}
      <div className="p-4 border-t border-[#2a2a4a]/40">
        <button className="flex items-center gap-3 w-full px-2 py-2 text-[#e11d48] hover:bg-[#e11d48]/10 rounded-lg transition-colors text-sm font-medium">
          <LogOut size={18} />
          {isOpen && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}
