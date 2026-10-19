// Change only the CSQ image tag. All credentials, ports and data mounts stay byte-for-byte intact.
export function versionedCompose(text,version) {
  if(!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(version))throw Error('無效版號');
  const newline=text.includes('\r\n')?'\r\n':'\n',lines=text.split(newline);
  const start=lines.findIndex(s=>s==='  csq:');
  if(start<0||lines.filter(s=>s==='  csq:').length!==1)throw Error('找不到唯一 CSQ 服務');
  let end=start+1;while(end<lines.length&&!/^  \S/.test(lines[end])&&!/^\S/.test(lines[end]))end++;
  const build=lines.findIndex((s,i)=>i>start&&i<end&&/^    build: \.[ ]*$/.test(s));
  if(build<0)throw Error('CSQ 建置設定不符，停止自動修改');
  const images=lines.map((s,i)=>/^    image:/.test(s)&&i>start&&i<end?i:-1).filter(i=>i>=0);
  if(images.length>1)throw Error('重複映像檔設定');
  if(images.length){if(!/^    image: cisalfa-csq:[\w.-]+\s*$/.test(lines[images[0]]))throw Error('現有映像檔設定須人工核對');lines[images[0]]=`    image: cisalfa-csq:${version}`;}
  else lines.splice(build+1,0,`    image: cisalfa-csq:${version}`);
  return lines.join(newline);
}
