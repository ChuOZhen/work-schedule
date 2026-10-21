param(
  [string]$OutDir = "shots",
  [string]$ProcessName = "electron"
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WinScan {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }

  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder s, int max);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attr, out RECT r, int size);

  public static List<IntPtr> List(uint[] pids) {
    var found = new List<IntPtr>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      foreach (var p in pids) if (p == pid) { found.Add(h); break; }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  public static RECT Bounds(IntPtr h) {
    RECT r;
    try {
      if (DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT))) == 0) return r;
    } catch {}
    GetWindowRect(h, out r);
    return r;
  }
}
"@

$pids = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | ForEach-Object { [uint32]$_.Id })
if ($pids.Count -eq 0) { Write-Output "no process"; exit 1 }

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$wins = [WinScan]::List($pids)
$i = 0
foreach ($h in $wins) {
  $r = [WinScan]::Bounds($h)
  $w = $r.Right - $r.Left
  $ht = $r.Bottom - $r.Top
  if ($w -lt 60 -or $ht -lt 60) { continue }
  $i++
  [WinScan]::ShowWindow($h, 5) | Out-Null
  [WinScan]::SetWindowPos($h, [IntPtr](-1), 0, 0, 0, 0, 0x0001 -bor 0x0002) | Out-Null
  [WinScan]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Milliseconds 500
  $bmp = New-Object System.Drawing.Bitmap($w, $ht)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
  $path = Join-Path $OutDir ("window-$i.png")
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output ("saved {0}  {1}x{2} at {3},{4}" -f $path, $w, $ht, $r.Left, $r.Top)
}
