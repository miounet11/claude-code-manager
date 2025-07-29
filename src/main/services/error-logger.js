'use strict';

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const EventEmitter = require('events');

/**
 * 错误日志记录器
 */
class ErrorLogger extends EventEmitter {
  constructor() {
    super();
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.errorLogFile = path.join(this.logDir, 'error.log');
    this.errorLogArchive = path.join(this.logDir, 'error-archive.log');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxArchiveFiles = 5;
    this.memoryLog = [];
    this.maxMemoryLog = 100;
    
    // 确保日志目录存在
    this.ensureLogDirectory();
  }
  
  /**
   * 确保日志目录存在
   */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }
  
  /**
   * 记录错误日志
   */
  async log(errorInfo) {
    try {
      // 1. 格式化日志条目
      const logEntry = this.formatLogEntry(errorInfo);
      
      // 2. 写入文件
      await this.writeToFile(logEntry);
      
      // 3. 保存到内存
      this.saveToMemory(errorInfo);
      
      // 4. 发出事件
      this.emit('logged', errorInfo);
      
    } catch (error) {
      // 日志记录失败，至少输出到控制台
      console.error('Failed to log error:', error);
      console.error('Original error:', errorInfo);
    }
  }
  
  /**
   * 格式化日志条目
   */
  formatLogEntry(errorInfo) {
    const separator = '='.repeat(80);
    const lines = [
      separator,
      `[${errorInfo.timestamp}] ${errorInfo.severity.toUpperCase()}: ${errorInfo.message}`,
      `ID: ${errorInfo.id}`,
      `Type: ${errorInfo.type}`,
      ''
    ];
    
    if (errorInfo.detail) {
      lines.push('Details:', errorInfo.detail, '');
    }
    
    if (errorInfo.suggestion) {
      lines.push('Suggestion:', errorInfo.suggestion, '');
    }
    
    if (errorInfo.stack) {
      lines.push('Stack Trace:', errorInfo.stack, '');
    }
    
    if (errorInfo.context && Object.keys(errorInfo.context).length > 0) {
      lines.push('Context:', JSON.stringify(errorInfo.context, null, 2), '');
    }
    
    lines.push('System Info:', JSON.stringify(errorInfo.system, null, 2));
    lines.push(separator, '');
    
    return lines.join('\n');
  }
  
  /**
   * 写入日志文件
   */
  async writeToFile(logEntry) {
    try {
      // 检查文件大小
      await this.checkLogRotation();
      
      // 追加写入
      await fs.appendFile(this.errorLogFile, logEntry + '\n', 'utf8');
      
    } catch (error) {
      console.error('Failed to write log file:', error);
    }
  }
  
  /**
   * 检查日志轮转
   */
  async checkLogRotation() {
    try {
      const stats = await fs.stat(this.errorLogFile);
      
      if (stats.size >= this.maxLogSize) {
        // 轮转日志文件
        await this.rotateLog();
      }
    } catch (error) {
      // 文件不存在，无需轮转
      if (error.code !== 'ENOENT') {
        console.error('Failed to check log rotation:', error);
      }
    }
  }
  
  /**
   * 轮转日志文件
   */
  async rotateLog() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveName = `error-${timestamp}.log`;
      const archivePath = path.join(this.logDir, archiveName);
      
      // 移动当前日志到归档
      await fs.rename(this.errorLogFile, archivePath);
      
      // 清理旧的归档文件
      await this.cleanupOldArchives();
      
      this.emit('rotated', archivePath);
    } catch (error) {
      console.error('Failed to rotate log:', error);
    }
  }
  
  /**
   * 清理旧的归档文件
   */
  async cleanupOldArchives() {
    try {
      const files = await fs.readdir(this.logDir);
      const archives = files
        .filter(f => f.startsWith('error-') && f.endsWith('.log'))
        .sort()
        .reverse();
      
      // 删除超过限制的文件
      if (archives.length > this.maxArchiveFiles) {
        const toDelete = archives.slice(this.maxArchiveFiles);
        for (const file of toDelete) {
          await fs.unlink(path.join(this.logDir, file));
        }
      }
    } catch (error) {
      console.error('Failed to cleanup archives:', error);
    }
  }
  
  /**
   * 保存到内存日志
   */
  saveToMemory(errorInfo) {
    this.memoryLog.unshift({
      id: errorInfo.id,
      timestamp: errorInfo.timestamp,
      type: errorInfo.type,
      severity: errorInfo.severity,
      message: errorInfo.message,
      detail: errorInfo.detail
    });
    
    // 限制内存日志大小
    if (this.memoryLog.length > this.maxMemoryLog) {
      this.memoryLog = this.memoryLog.slice(0, this.maxMemoryLog);
    }
  }
  
  /**
   * 获取最近的错误日志
   */
  getRecentLogs(count = 10) {
    return this.memoryLog.slice(0, count);
  }
  
  /**
   * 读取日志文件
   */
  async readLogFile(lines = 100) {
    try {
      const content = await fs.readFile(this.errorLogFile, 'utf8');
      const allLines = content.split('\n');
      
      // 返回最后 N 行
      return allLines.slice(-lines).join('\n');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return '日志文件不存在';
      }
      throw error;
    }
  }
  
  /**
   * 搜索日志
   */
  async searchLogs(query, options = {}) {
    try {
      const content = await fs.readFile(this.errorLogFile, 'utf8');
      const lines = content.split('\n');
      const results = [];
      
      const regex = new RegExp(query, options.ignoreCase ? 'i' : '');
      
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          // 获取错误块（从分隔符到分隔符）
          const block = this.extractErrorBlock(lines, i);
          if (block) {
            results.push(block);
          }
        }
      }
      
      return results.slice(0, options.limit || 50);
    } catch (error) {
      console.error('Failed to search logs:', error);
      return [];
    }
  }
  
  /**
   * 提取错误块
   */
  extractErrorBlock(lines, index) {
    const separator = '='.repeat(80);
    let start = index;
    let end = index;
    
    // 向上查找开始分隔符
    while (start > 0 && lines[start] !== separator) {
      start--;
    }
    
    // 向下查找结束分隔符
    while (end < lines.length - 1 && lines[end] !== separator) {
      end++;
    }
    
    if (start !== end) {
      return lines.slice(start, end + 1).join('\n');
    }
    
    return null;
  }
  
  /**
   * 清空日志
   */
  async clearLogs() {
    try {
      await fs.writeFile(this.errorLogFile, '', 'utf8');
      this.memoryLog = [];
      this.emit('cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error);
      throw error;
    }
  }
  
  /**
   * 导出日志
   */
  async exportLogs(outputPath) {
    try {
      const content = await fs.readFile(this.errorLogFile, 'utf8');
      const exportData = {
        exportDate: new Date().toISOString(),
        appVersion: app.getVersion(),
        platform: process.platform,
        logs: content,
        memoryLogs: this.memoryLog
      };
      
      await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
      return outputPath;
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  }
  
  /**
   * 获取日志统计
   */
  async getStatistics() {
    try {
      const stats = await fs.stat(this.errorLogFile);
      const files = await fs.readdir(this.logDir);
      const archives = files.filter(f => f.startsWith('error-') && f.endsWith('.log'));
      
      return {
        currentSize: stats.size,
        maxSize: this.maxLogSize,
        archiveCount: archives.length,
        memoryLogCount: this.memoryLog.length,
        logPath: this.errorLogFile
      };
    } catch (error) {
      return {
        currentSize: 0,
        maxSize: this.maxLogSize,
        archiveCount: 0,
        memoryLogCount: this.memoryLog.length,
        logPath: this.errorLogFile,
        error: error.message
      };
    }
  }
}

// 导出单例
module.exports = new ErrorLogger();