const path = require('path');
const fs = require('fs');

// 加载所有mapper文件
function loadMappers() {
  const mappers = {};
  const mappersPath = path.join(__dirname, '../mapper');
  
  // 检查目录是否存在
  if (fs.existsSync(mappersPath)) {
    const files = fs.readdirSync(mappersPath);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const name = path.basename(file, '.js');
        mappers[name] = require(path.join(mappersPath, file));
      }
    }
  }
  
  return mappers;
}

module.exports = {
  // 应用启动时加载所有SQL mapper
  get mapper() {
    if (!this._mapper) {
      this._mapper = loadMappers();
    }
    return this._mapper;
  },
}; 