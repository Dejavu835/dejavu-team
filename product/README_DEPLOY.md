# GitHub Pages 部署包

这个目录已经是可直接用于 GitHub Pages 的静态站点结构。

## 文件

- `index.html`：单文件离线版网页
- `.nojekyll`：告诉 GitHub Pages 直接发布静态文件
- `CNAME.example`：自定义域名示例文件

## 上线步骤

1. 登录 GitHub CLI：

   ```bash
   gh auth login
   ```

2. 新建一个公开仓库，例如：

   ```bash
   gh repo create apple-log-workbench-web --public
   ```

3. 把这个目录里的文件推到仓库根目录。

4. 在 GitHub 仓库里开启 Pages。

5. 开启后会得到类似：

   ```text
   https://你的用户名.github.io/仓库名/
   ```

## 自定义域名

如果你有自己的域名：

1. 在仓库 Pages 设置中填写你的域名
2. 按 GitHub Pages 要求配置 DNS
3. 可选但建议先做域名验证

## 说明

- 这套部署包不依赖 Python 服务
- 可直接公开访问
- 单文件版保留本地日志分析、知识库、备注、最近记录
- OCR 不在纯静态部署范围内，后续要加的话需要单独后端
