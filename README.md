# Memory Vault

这是一个基于 React 和 Vite 构建的前端项目，用于与 Walrus 测试网络进行交互。

## 功能特点

- 支持与多个 Walrus 测试网络聚合器和发布者节点交互
- 使用 Sui 区块链进行交易
- 支持创建和管理订阅服务
- 现代化的用户界面设计

## 技术栈

- React 19
- Vite
- TypeScript
- @mysten/dapp-kit
- @mysten/sui
- @radix-ui/themes

## 安装

确保你的系统已安装 Node.js 和 pnpm

```bash
# 使用 pnpm
pnpm install
```

## 运行开发服务器

```bash
# 或使用 pnpm
pnpm run dev
```

开发服务器将在 http://localhost:5174 上运行。

## 配置

项目支持与以下测试网络节点交互：

### 聚合器节点

- aggregator.walrus-testnet.walrus.space
- wal-aggregator-testnet.staketab.org
- walrus-testnet-aggregator.redundex.com
- walrus-testnet-aggregator.nodes.guru
- aggregator.walrus.banansen.dev
- walrus-testnet-aggregator.everstake.one

### 发布者节点

- publisher.walrus-testnet.walrus.space
- wal-publisher-testnet.staketab.org
- walrus-testnet-publisher.redundex.com
- walrus-testnet-publisher.nodes.guru
- publisher.walrus.banansen.dev
- walrus-testnet-publisher.everstake.one

## 构建生产版本

```bash
# 使用 pnpm
pnpm run build
```

## 代码质量工具

项目包含以下代码质量工具：

- ESLint：用于代码检查
- Prettier：用于代码格式化
- TypeScript：用于类型检查

运行代码检查和格式化：

```bash
# 运行 ESLint 检查
pnpm run lint

# 运行 Prettier 检查
pnpm run prettier:check

# 自动修复 ESLint 问题
pnpm run lint:fix

# 自动修复 Prettier 问题
pnpm run prettier:fix
```

## 许可证

Apache-2.0
