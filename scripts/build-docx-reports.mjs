import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const reportsDir = path.join(repoRoot, 'reports');
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'onboarding-reports-'));
const keepTemp = process.env.KEEP_REPORT_TEMP === '1';

const reports = [
  {
    source:'Project1_ToDoList_결과보고서.html',
    output:'Project1_ToDoList_결과보고서.docx',
    imageWidthTwips:9000,
    expectedImages:6
  },
  {
    source:'Project2_회원가입_결과보고서.html',
    output:'Project2_회원가입_결과보고서.docx',
    imageWidthTwips:7000,
    expectedImages:8
  }
];

function getPngDimensions(buffer){
  const pngSignature = '89504e470d0a1a0a';
  if(buffer.subarray(0, 8).toString('hex') !== pngSignature){
    throw new Error('PNG 파일만 DOCX 보고서에 삽입할 수 있습니다.');
  }
  return {
    width:buffer.readUInt32BE(16),
    height:buffer.readUInt32BE(20)
  };
}

function escapeRegex(value){
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(value){
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function createDrawingXml({ filename, relationshipId, drawingId, width, height }){
  const widthEmu = width * 635;
  const heightEmu = height * 635;
  const name = escapeXml(filename);

  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>`
    + `<wp:inline distT="0" distB="0" distL="0" distR="0">`
    + `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/>`
    + `<wp:effectExtent l="0" t="0" r="0" b="0"/>`
    + `<wp:docPr id="${drawingId}" name="${name}"/>`
    + `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>`
    + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`
    + `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
    + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`
    + `<pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>`
    + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
    + `</pic:pic></a:graphicData></a:graphic>`
    + `</wp:inline></w:drawing></w:r></w:p>`;
}

try{
  for(const report of reports){
    const sourcePath = path.join(reportsDir, report.source);
    const tempHtml = path.join(tempDir, report.source);
    const baseDocx = tempHtml.replace(/\.html$/, '-base.docx');
    const packageDir = tempHtml.replace(/\.html$/, '-package');
    const tempDocx = tempHtml.replace(/\.html$/, '.docx');
    const images = [];

    let html = await readFile(sourcePath, 'utf8');
    html = html.replace(/<img src="screenshots\/([^"]+)"[^>]*>/g, (_, filename) => {
      const marker = `[[IMG_${images.length + 1}]]`;
      images.push({ marker, filename });
      return `<p>${marker}</p>`;
    });

    if(images.length !== report.expectedImages){
      throw new Error(`${report.source}: 예상 이미지 ${report.expectedImages}개, 실제 ${images.length}개`);
    }

    await writeFile(tempHtml, html);
    execFileSync('textutil', ['-convert', 'docx', '-output', baseDocx, tempHtml]);
    await mkdir(packageDir);
    execFileSync('unzip', ['-q', baseDocx, '-d', packageDir]);
    await mkdir(path.join(packageDir, 'word', 'media'), { recursive:true });

    const documentPath = path.join(packageDir, 'word', 'document.xml');
    const relationshipsPath = path.join(packageDir, 'word', '_rels', 'document.xml.rels');
    const contentTypesPath = path.join(packageDir, '[Content_Types].xml');
    let documentXml = await readFile(documentPath, 'utf8');
    let relationshipsXml = await readFile(relationshipsPath, 'utf8');
    let contentTypesXml = await readFile(contentTypesPath, 'utf8');

    for(const [index, image] of images.entries()){
      const imageBuffer = await readFile(path.join(reportsDir, 'screenshots', image.filename));
      const dimensions = getPngDimensions(imageBuffer);
      const relationshipId = `rIdReportImage${index + 1}`;
      const imageName = `report-image-${index + 1}.png`;
      const imageWidth = report.imageWidthTwips;
      const imageHeight = Math.round(imageWidth * dimensions.height / dimensions.width);
      const paragraphPattern = new RegExp(
        `<w:p(?=[ >])(?:(?!<w:p(?=[ >]))[\\s\\S])*?${escapeRegex(image.marker)}`
        + `(?:(?!<w:p(?=[ >]))[\\s\\S])*?<\\/w:p>`
      );

      if(!paragraphPattern.test(documentXml)){
        throw new Error(`${report.source}: ${image.marker} 문단을 찾을 수 없습니다.`);
      }

      documentXml = documentXml.replace(paragraphPattern, createDrawingXml({
        filename:image.filename,
        relationshipId,
        drawingId:index + 1,
        width:imageWidth,
        height:imageHeight
      }));
      relationshipsXml = relationshipsXml.replace(
        '</Relationships>',
        `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageName}"/></Relationships>`
      );
      await copyFile(
        path.join(reportsDir, 'screenshots', image.filename),
        path.join(packageDir, 'word', 'media', imageName)
      );
    }

    if(documentXml.includes('[[IMG_')){
      throw new Error(`${report.source}: 치환되지 않은 이미지 자리표시자가 있습니다.`);
    }
    const drawingReferences = (documentXml.match(/rIdReportImage\d+/g) || []).length;
    if(drawingReferences !== report.expectedImages){
      throw new Error(`${report.output}: 그림 참조 ${report.expectedImages}개 필요, 실제 ${drawingReferences}개`);
    }
    if(!contentTypesXml.includes('Extension="png"')){
      contentTypesXml = contentTypesXml.replace(
        '</Types>',
        '<Default Extension="png" ContentType="image/png"/></Types>'
      );
    }

    await writeFile(documentPath, documentXml);
    await writeFile(relationshipsPath, relationshipsXml);
    await writeFile(contentTypesPath, contentTypesXml);
    execFileSync('zip', ['-X', '-q', '-r', tempDocx, '.'], { cwd:packageDir });

    const archive = execFileSync('unzip', ['-l', tempDocx], { encoding:'utf8' });
    const embeddedImages = (archive.match(/word\/media\/[^\s]+\.png/g) || []).length;
    if(embeddedImages !== report.expectedImages){
      throw new Error(`${report.output}: 내장 이미지 ${report.expectedImages}개 필요, 실제 ${embeddedImages}개`);
    }

    await copyFile(tempDocx, path.join(repoRoot, report.output));
    console.log(`${report.output}: 이미지 ${embeddedImages}개 포함`);
  }
} finally {
  if(keepTemp) console.log(`임시 보고서 경로: ${tempDir}`);
  else await rm(tempDir, { recursive:true, force:true });
}
