# 快速重建指南

## 下次会话直接发送以下指令即可：

---

请基于 `/Users/denggui/2026code/n8n-nodes-deerapi-handover/` 目录下的交接文档，
重建 `n8n-nodes-deerapi-plus` 项目。

交接文档包含：
- HANDOVER.md — 项目结构、配置、命名规则、部署方式
- OPERATIONS.md — 4 个操作的 API 参数和 n8n 字段定义
- TRANSPORT.md — HTTP 请求、错误清洗、响应解析的完整代码

请按以下顺序重建：
1. 初始化项目（package.json, tsconfig.json, jest.config.js）
2. 创建凭证文件
3. 创建 Transport 层（3 个文件）
4. 创建 4 个操作文件 + 路由
5. 创建主节点文件
6. 编写单元测试
7. 编译验证
8. 安装到 ~/.n8n/nodes 并在 n8n 中测试

---

## 关键提醒

### 命名踩坑（必读）
- 文件名 `DeerApi.node.ts` → 类名必须是 `DeerApi`
- 凭证文件名 `DeerApiApi.credentials.ts` → 类名必须是 `DeerApiApi`
- package.json 中 n8n.nodes 路径必须指向编译后的 `.js` 文件
- build 脚本必须包含 SVG 复制步骤

### Docker n8n 测试步骤
```bash
# 1. 编译
cd /path/to/n8n-nodes-deerapi-plus
npm run build

# 2. 安装到 n8n
cd ~/.n8n/nodes
npm install /path/to/n8n-nodes-deerapi-plus

# 3. 重启 n8n
docker restart n8n

# 4. 检查节点是否加载
docker logs n8n 2>&1 | grep -i deer
```

### 常见问题
1. **节点不出现** → 检查 package.json 的 n8n.nodes 路径是否正确
2. **类名不匹配** → n8n 根据文件名推断类名，确保一致
3. **图标不显示** → 确认 SVG 已复制到 dist 目录
4. **凭证不出现** → 检查 package.json 的 n8n.credentials 路径

## 文件清单

```
n8n-nodes-deerapi-handover/
├── HANDOVER.md      # 主交接文档（结构+配置+部署）
├── OPERATIONS.md    # 4 个操作的代码参考
├── TRANSPORT.md     # Transport 层代码参考
└── REBUILD.md       # 本文件（快速重建指南）
```
