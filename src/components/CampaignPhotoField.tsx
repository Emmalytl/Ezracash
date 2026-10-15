"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Link2, Upload, X } from 'lucide-react';
import { campaignPhotoError } from '@/lib/campaign-upload';
import styles from './CampaignPhotoField.module.css';

type Props = { image: string; onImageChange: (image:string)=>void; file:File|null; onFileChange:(file:File|null)=>void; disabled?:boolean };
export default function CampaignPhotoField({image,onImageChange,file,onFileChange,disabled=false}:Props) {
  const id=useId();
  const picker=useRef<HTMLInputElement>(null);
  const [preview,setPreview]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    if (!file) {setPreview('');return;}
    const url=URL.createObjectURL(file);setPreview(url);
    return ()=>URL.revokeObjectURL(url);
  },[file]);
  function choose(selected:File|null) {
    if (!selected) return;
    const problem=campaignPhotoError(selected);
    setError(problem);
    if (problem) {if(picker.current)picker.current.value='';return;}
    onFileChange(selected);
  }
  function remove() {
    if (file) onFileChange(null); else onImageChange('');
    if(picker.current)picker.current.value='';
    setError('');
  }
  return <div className={styles.field}>
    <div className={styles.heading}><span>Campaign picture</span><small>Optional</small></div>
    <div className={styles.box}>
      {(preview||image)?<div className={styles.preview}><img src={preview||image} alt="Campaign picture preview"/><button type="button" onClick={remove} disabled={disabled} aria-label={file?'Remove selected upload':'Remove campaign picture'}><X size={16}/></button></div>:<div className={styles.placeholder}><ImagePlus size={27}/><strong>Bring your campaign to life</strong><span>Choose a clear picture that tells its story.</span></div>}
      <div className={styles.actions}><button type="button" onClick={()=>picker.current?.click()} disabled={disabled}><Upload size={16}/>{file?'Choose another picture':image?'Replace picture':'Upload picture'}</button><span>{file?<><strong>{file.name}</strong><small>{(file.size/1024/1024).toFixed(1)} MB · ready to save</small></>:<>JPG, PNG or WebP<br/>Up to 3 MB</>}</span></div>
      <input ref={picker} id={`${id}-upload`} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} aria-label="Upload campaign picture" onChange={event=>choose(event.target.files?.[0]||null)}/>
    </div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <details className={styles.urlOption}><summary><Link2 size={14}/>Use an image URL instead</summary><label htmlFor={`${id}-url`}>Image URL (optional)</label><input id={`${id}-url`} type="text" inputMode="url" value={image} onChange={event=>onImageChange(event.target.value)} placeholder="https://example.com/picture.jpg" disabled={disabled||Boolean(file)}/><p>{file?'Remove the selected upload to use a URL instead.':'Leave this empty if you upload a picture. You can also save without a picture.'}</p></details>
  </div>;
}
