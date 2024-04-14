resource "digitalocean_droplet" "web" {
  count  = 2
  name   = "grass-${count.index}"
  image  = "docker-20-04"
  region = "sfo3"
  size   = "s-1vcpu-2gb"

  ssh_keys = ["71:7a:bd:0a:09:3b:f1:b0:49:d1:a1:3e:0d:32:09:5c"]
  monitoring = true
  graceful_shutdown = true

  connection {
    type     = "ssh"
    user     = "root"
    private_key = file("./pk.key")
    host     = self.ipv4_address
  }

  provisioner "file" {
    source      = "../docker-compose.yaml"
    destination = "/root/docker-compose.yaml"
  }

  provisioner "file" {
    source      = "./scripts/script.sh"
    destination = "/root/script.sh"
  }

  provisioner "remote-exec" {
    inline = [
      "chmod +x /root/script.sh",
      "sh /root/script.sh",
    ]
  }
}